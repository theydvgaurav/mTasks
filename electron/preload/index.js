const { contextBridge, ipcRenderer } = require('electron');

const bridge = {
  auth: {
    getSession: () => ipcRenderer.invoke('auth:get-session'),
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout')
  },
  tasks: {
    getTaskLists: () => ipcRenderer.invoke('tasks:get-task-lists'),
    getTasks: (taskListId) => ipcRenderer.invoke('tasks:get-tasks', taskListId),
    createTask: (taskListId, payload) => ipcRenderer.invoke('tasks:create-task', taskListId, payload),
    updateTask: (taskListId, taskId, payload) =>
      ipcRenderer.invoke('tasks:update-task', taskListId, taskId, payload),
    deleteTask: (taskListId, taskId) => ipcRenderer.invoke('tasks:delete-task', taskListId, taskId)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (payload) => ipcRenderer.invoke('settings:update', payload)
  }
};

contextBridge.exposeInMainWorld('mtasks', bridge);
contextBridge.exposeInMainWorld('appBridge', bridge);
contextBridge.exposeInMainWorld('__mtasksBridgeReady', true);
