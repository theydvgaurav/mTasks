const { google } = require('googleapis');

class TaskService {
  constructor(authManager) {
    this.authManager = authManager;
  }

  async listTaskLists() {
    const authClient = await this.authManager.getAuthorizedClient();
    const tasks = google.tasks({ version: 'v1', auth: authClient });

    const response = await tasks.tasklists.list({ maxResults: 100, showHidden: false });
    const items = (response.data.items || []).map((taskList) => ({
      id: taskList.id,
      title: taskList.title,
      updatedAt: taskList.updated || null
    }));

    return {
      taskLists: items,
      defaultTaskListId: items[0]?.id || null
    };
  }

  async listTasks(taskListId) {
    const authClient = await this.authManager.getAuthorizedClient();
    const tasks = google.tasks({ version: 'v1', auth: authClient });

    const response = await tasks.tasks.list({
      tasklist: taskListId,
      maxResults: 100,
      showCompleted: true,
      showDeleted: false,
      showHidden: true
    });

    return {
      tasks: (response.data.items || []).map(normalizeTask)
    };
  }

  async createTask(taskListId, payload) {
    const authClient = await this.authManager.getAuthorizedClient();
    const tasks = google.tasks({ version: 'v1', auth: authClient });

    const response = await tasks.tasks.insert({
      tasklist: taskListId,
      requestBody: {
        title: payload.title,
        notes: payload.notes || undefined,
        due: payload.due || undefined
      }
    });

    return normalizeTask(response.data);
  }

  async updateTask(taskListId, taskId, payload) {
    const authClient = await this.authManager.getAuthorizedClient();
    const tasks = google.tasks({ version: 'v1', auth: authClient });

    const response = await tasks.tasks.patch({
      tasklist: taskListId,
      task: taskId,
      requestBody: toGoogleTaskPatch(payload)
    });

    return normalizeTask(response.data);
  }

  async deleteTask(taskListId, taskId) {
    const authClient = await this.authManager.getAuthorizedClient();
    const tasks = google.tasks({ version: 'v1', auth: authClient });

    await tasks.tasks.delete({
      tasklist: taskListId,
      task: taskId
    });

    return { success: true };
  }
}

function toGoogleTaskPatch(payload) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'title')) {
    patch.title = payload.title;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'completed')) {
    if (payload.completed) {
      patch.status = 'completed';
      patch.completed = new Date().toISOString();
    } else {
      patch.status = 'needsAction';
      patch.completed = null;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
    patch.notes = payload.notes;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'due')) {
    patch.due = payload.due;
  }

  return patch;
}

function normalizeTask(task) {
  return {
    id: task.id,
    title: task.title || '',
    notes: task.notes || '',
    status: task.status,
    completed: task.status === 'completed',
    completedAt: task.completed || null,
    due: task.due || null,
    parent: task.parent || null,
    position: task.position || null,
    updatedAt: task.updated || null
  };
}

module.exports = {
  TaskService
};
