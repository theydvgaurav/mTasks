const crypto = require('node:crypto');
const http = require('node:http');
const { URL } = require('node:url');
const { shell } = require('electron');
const keytar = require('keytar');
const { google } = require('googleapis');

const TOKEN_ACCOUNT = 'google_oauth_tokens';
const USER_ACCOUNT = 'google_profile';
const REQUIRED_SCOPES = [
  'https://www.googleapis.com/auth/tasks',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
];

class AuthManager {
  constructor({ clientId, clientSecret, redirectPort, serviceName }) {
    this.clientId = clientId;
    this.clientSecret = clientSecret || '';
    this.redirectPort = Number(redirectPort || 42813);
    this.serviceName = serviceName || 'mtasks';
    this.redirectUri = `http://127.0.0.1:${this.redirectPort}/oauth2callback`;

    this.oauthClient = null;
    this.user = null;
    this.credentials = null;
    this.oauthFlowInProgress = false;

    if (this.isConfigured()) {
      this.oauthClient = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );
      this.oauthClient.on('tokens', (tokens) => {
        this.credentials = {
          ...this.credentials,
          ...tokens
        };
        this.oauthClient.setCredentials(this.credentials);
        void this.persistCredentials();
      });
    }
  }

  isConfigured() {
    return Boolean(this.clientId);
  }

  async initialize() {
    if (!this.isConfigured()) {
      return;
    }

    const rawTokens = await keytar.getPassword(this.serviceName, TOKEN_ACCOUNT);
    const rawUser = await keytar.getPassword(this.serviceName, USER_ACCOUNT);

    if (rawTokens) {
      try {
        this.credentials = JSON.parse(rawTokens);
        this.oauthClient.setCredentials(this.credentials);
      } catch {
        this.credentials = null;
      }
    }

    if (rawUser) {
      try {
        this.user = JSON.parse(rawUser);
      } catch {
        this.user = null;
      }
    }

    if (this.credentials?.refresh_token) {
      try {
        await this.ensureValidAccessToken();
        if (!this.user) {
          this.user = await this.fetchUserProfile();
          await this.persistUser();
        }
      } catch {
        await this.logout({ revoke: false });
      }
    }
  }

  async getSession() {
    if (!this.isConfigured()) {
      return {
        configured: false,
        isAuthenticated: false,
        user: null
      };
    }

    if (!this.credentials?.refresh_token) {
      return {
        configured: true,
        isAuthenticated: false,
        user: null
      };
    }

    try {
      await this.ensureValidAccessToken();
      if (!this.user) {
        this.user = await this.fetchUserProfile();
        await this.persistUser();
      }

      return {
        configured: true,
        isAuthenticated: true,
        user: this.user
      };
    } catch (error) {
      await this.logout({ revoke: false });
      return {
        configured: true,
        isAuthenticated: false,
        user: null
      };
    }
  }

  async login() {
    if (!this.isConfigured()) {
      const error = new Error('Google OAuth is not configured.');
      error.code = 'oauth_not_configured';
      throw error;
    }

    if (this.oauthFlowInProgress) {
      const error = new Error('Login is already in progress.');
      error.code = 'oauth_in_progress';
      throw error;
    }

    this.oauthFlowInProgress = true;

    try {
      const state = crypto.randomBytes(16).toString('hex');
      const pkce = await this.createPkcePair();
      const authUrl = this.oauthClient.generateAuthUrl({
        access_type: 'offline',
        include_granted_scopes: true,
        prompt: this.credentials?.refresh_token ? 'select_account' : 'consent',
        scope: REQUIRED_SCOPES,
        state,
        code_challenge_method: 'S256',
        code_challenge: pkce.codeChallenge
      });

      const authCode = await this.exchangeAuthCodeFromLocalServer(authUrl, state);
      const tokenResponse = await this.oauthClient.getToken({
        code: authCode,
        codeVerifier: pkce.codeVerifier,
        redirect_uri: this.redirectUri
      });
      const newCredentials = tokenResponse.tokens;

      if (!newCredentials.refresh_token && this.credentials?.refresh_token) {
        newCredentials.refresh_token = this.credentials.refresh_token;
      }

      this.credentials = {
        ...this.credentials,
        ...newCredentials
      };

      this.oauthClient.setCredentials(this.credentials);
      await this.ensureValidAccessToken();
      this.user = await this.fetchUserProfile();

      await this.persistCredentials();
      await this.persistUser();

      return {
        configured: true,
        isAuthenticated: true,
        user: this.user
      };
    } catch (error) {
      throw this.normalizeAuthError(error);
    } finally {
      this.oauthFlowInProgress = false;
    }
  }

  async logout({ revoke = true } = {}) {
    const tokenToRevoke = this.credentials?.refresh_token || this.credentials?.access_token;
    if (revoke && tokenToRevoke) {
      try {
        await this.oauthClient.revokeToken(tokenToRevoke);
      } catch {
        // Ignore revoke failures and continue local cleanup.
      }
    }

    this.credentials = null;
    this.user = null;

    if (this.oauthClient) {
      this.oauthClient.setCredentials({});
    }

    await Promise.all([
      keytar.deletePassword(this.serviceName, TOKEN_ACCOUNT),
      keytar.deletePassword(this.serviceName, USER_ACCOUNT)
    ]);

    return {
      configured: this.isConfigured(),
      isAuthenticated: false,
      user: null
    };
  }

  async getAuthorizedClient() {
    if (!this.credentials?.refresh_token) {
      const error = new Error('Authentication required.');
      error.code = 'unauthorized';
      throw error;
    }

    await this.ensureValidAccessToken();
    return this.oauthClient;
  }

  async ensureValidAccessToken() {
    if (!this.oauthClient || !this.credentials?.refresh_token) {
      const error = new Error('Authentication required.');
      error.code = 'unauthorized';
      throw error;
    }

    this.oauthClient.setCredentials(this.credentials);
    await this.oauthClient.getAccessToken();

    this.credentials = {
      ...this.credentials,
      ...this.oauthClient.credentials
    };

    await this.persistCredentials();
  }

  async fetchUserProfile() {
    const oauth2 = google.oauth2({ version: 'v2', auth: this.oauthClient });
    const response = await oauth2.userinfo.get();
    const profile = response.data;

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture
    };
  }

  async persistCredentials() {
    if (!this.credentials) {
      return;
    }

    await keytar.setPassword(
      this.serviceName,
      TOKEN_ACCOUNT,
      JSON.stringify(this.credentials)
    );
  }

  async persistUser() {
    if (!this.user) {
      return;
    }

    await keytar.setPassword(this.serviceName, USER_ACCOUNT, JSON.stringify(this.user));
  }

  async createPkcePair() {
    if (typeof this.oauthClient.generateCodeVerifierAsync === 'function') {
      return this.oauthClient.generateCodeVerifierAsync();
    }

    const codeVerifier = crypto.randomBytes(64).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return {
      codeVerifier,
      codeChallenge
    };
  }

  exchangeAuthCodeFromLocalServer(authUrl, expectedState) {
    return new Promise((resolve, reject) => {
      let resolved = false;

      const server = http.createServer((req, res) => {
        const parsed = new URL(req.url || '/', this.redirectUri);

        if (parsed.pathname !== '/oauth2callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = parsed.searchParams.get('code');
        const state = parsed.searchParams.get('state');
        const oauthError = parsed.searchParams.get('error');

        if (oauthError) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h3>Login canceled</h3>You can close this tab.</body></html>');
          const authError = new Error(`OAuth error: ${oauthError}`);
          authError.code = oauthError === 'access_denied' ? 'oauth_access_denied' : 'oauth_callback_error';
          finish(authError);
          return;
        }

        if (state !== expectedState || !code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<html><body><h3>Invalid callback</h3>You can close this tab.</body></html>');
          const validationError = new Error('OAuth callback validation failed.');
          validationError.code = 'oauth_callback_validation_failed';
          finish(validationError);
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(
          '<html><body style="font-family: -apple-system;">' +
            '<h3>Signed in successfully</h3>' +
            '<p>You can close this tab and return to mTasks.</p>' +
            '</body></html>'
        );

        finish(null, code);
      });

      const finish = (error, code) => {
        if (resolved) {
          return;
        }
        resolved = true;
        clearTimeout(timeoutHandle);
        server.close();
        if (error) {
          reject(error);
          return;
        }
        resolve(code);
      };

      server.on('error', (error) => {
        if (error?.code === 'EADDRINUSE') {
          const portError = new Error(
            `OAuth callback port ${this.redirectPort} is already in use.`
          );
          portError.code = 'oauth_callback_port_in_use';
          finish(portError);
          return;
        }
        finish(error);
      });

      server.listen(this.redirectPort, '127.0.0.1', async () => {
        try {
          await shell.openExternal(authUrl);
        } catch (error) {
          finish(error);
        }
      });

      const timeoutHandle = setTimeout(() => {
        const timeoutError = new Error('OAuth login timed out.');
        timeoutError.code = 'oauth_timeout';
        finish(timeoutError);
      }, 180000);
    });
  }

  normalizeAuthError(error) {
    if (!error) {
      const unknown = new Error('OAuth login failed.');
      unknown.code = 'oauth_login_failed';
      return unknown;
    }

    if (
      error.code === 'oauth_not_configured' ||
      error.code === 'oauth_in_progress' ||
      error.code === 'oauth_timeout' ||
      error.code === 'oauth_access_denied' ||
      error.code === 'oauth_callback_error' ||
      error.code === 'oauth_callback_validation_failed' ||
      error.code === 'oauth_callback_port_in_use'
    ) {
      return error;
    }

    const responseError = error.response?.data?.error;
    const responseErrorCode =
      typeof responseError === 'string' ? responseError : responseError?.code || responseError?.status;
    const responseDescription =
      error.response?.data?.error_description ||
      responseError?.message ||
      error.response?.data?.error?.message;

    const map = {
      invalid_client: {
        code: 'oauth_invalid_client',
        message:
          'OAuth client is invalid. Verify GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET and OAuth client type.'
      },
      unauthorized_client: {
        code: 'oauth_unauthorized_client',
        message:
          'OAuth client is not authorized for this flow. Use a Desktop app OAuth client in Google Cloud.'
      },
      redirect_uri_mismatch: {
        code: 'oauth_redirect_uri_mismatch',
        message:
          `Redirect URI mismatch. Add ${this.redirectUri} to your OAuth client settings (or fix GOOGLE_OAUTH_REDIRECT_PORT).`
      },
      invalid_grant: {
        code: 'oauth_invalid_grant',
        message:
          'Authorization grant was rejected/expired. Retry sign-in and complete consent in one flow.'
      },
      access_denied: {
        code: 'oauth_access_denied',
        message: 'Google sign-in was denied.'
      }
    };

    if (responseErrorCode && map[responseErrorCode]) {
      const mapped = new Error(
        responseDescription
          ? `${map[responseErrorCode].message} (${responseDescription})`
          : map[responseErrorCode].message
      );
      mapped.code = map[responseErrorCode].code;
      return mapped;
    }

    const fallback = new Error(responseDescription || error.message || 'OAuth login failed.');
    fallback.code = 'oauth_login_failed';
    return fallback;
  }
}

module.exports = {
  AuthManager
};
