const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || '1.0.0',

  // Print invoice as PDF — saves file with invoice number as filename
  printInvoicePDF: (html, invoiceNo) => {
    return ipcRenderer.invoke('print-invoice-pdf', html, invoiceNo);
  },

  // Print any HTML content (statements, reports)
  printHTML: (html, title) => {
    return ipcRenderer.invoke('print-html', html, title);
  },

  // Backup & Restore Database
  backupDatabase: () => {
    return ipcRenderer.invoke('backup-database');
  },
  restoreDatabase: () => {
    return ipcRenderer.invoke('restore-database');
  },
});
