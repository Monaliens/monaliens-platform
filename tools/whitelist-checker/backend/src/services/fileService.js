const fs = require('fs').promises;
const path = require('path');

const WHITELISTS_DIR = path.join(__dirname, '../../../whitelists');

class FileService {
  // Get all whitelists
  async getAllWhitelists() {
    const whitelists = [];
    const categories = ['free', 'gtd', 'fcfs', 'public'];

    for (const category of categories) {
      const dir = path.join(WHITELISTS_DIR, category);
      const files = await this.getFilesInDir(dir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await this.readWhitelist(category, file.replace('.json', ''));
          if (data) whitelists.push({ ...data, category });
        }
      }
    }

    return whitelists;
  }

  // Get whitelists by category
  async getWhitelistsByCategory(category) {
    if (!['free', 'gtd', 'fcfs', 'public'].includes(category)) {
      throw new Error('Invalid category. Must be "free", "gtd", "fcfs", or "public"');
    }

    const whitelists = [];
    const dir = path.join(WHITELISTS_DIR, category);
    const files = await this.getFilesInDir(dir);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = await this.readWhitelist(category, file.replace('.json', ''));
        if (data) whitelists.push({ ...data, category });
      }
    }

    return whitelists;
  }

  // Read a specific whitelist
  async readWhitelist(category, name) {
    const filePath = path.join(WHITELISTS_DIR, category, `${name}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  // Create a new whitelist
  async createWhitelist(category, name, initialAddresses = []) {
    if (!['free', 'gtd', 'fcfs', 'public'].includes(category)) {
      throw new Error('Invalid category. Must be "free", "gtd", "fcfs", or "public"');
    }

    const filePath = path.join(WHITELISTS_DIR, category, `${name}.json`);

    // Check if already exists
    const exists = await this.fileExists(filePath);
    if (exists) {
      throw new Error(`Whitelist "${name}" already exists in ${category} category`);
    }

    const whitelist = {
      name,
      category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      addresses: initialAddresses
    };

    await fs.writeFile(filePath, JSON.stringify(whitelist, null, 2));
    return whitelist;
  }

  // Update whitelist (add/remove addresses)
  async updateWhitelist(category, name, addresses, operation = 'add') {
    const filePath = path.join(WHITELISTS_DIR, category, `${name}.json`);
    const whitelist = await this.readWhitelist(category, name);

    if (!whitelist) {
      throw new Error(`Whitelist "${name}" not found in ${category} category`);
    }

    if (operation === 'add') {
      // Add addresses (avoid duplicates within same list only)
      const newAddresses = addresses.filter(addr => !whitelist.addresses.includes(addr));
      whitelist.addresses.push(...newAddresses);
    } else if (operation === 'remove') {
      // Remove addresses
      whitelist.addresses = whitelist.addresses.filter(addr => !addresses.includes(addr));
    } else if (operation === 'replace') {
      // Replace all addresses
      whitelist.addresses = addresses;
    }

    whitelist.updatedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(whitelist, null, 2));
    return whitelist;
  }

  // Delete a whitelist
  async deleteWhitelist(category, name) {
    const filePath = path.join(WHITELISTS_DIR, category, `${name}.json`);
    const exists = await this.fileExists(filePath);

    if (!exists) {
      throw new Error(`Whitelist "${name}" not found in ${category} category`);
    }

    await fs.unlink(filePath);
    return { message: `Whitelist "${name}" deleted successfully` };
  }

  // Helper functions
  async getFilesInDir(dir) {
    try {
      return await fs.readdir(dir);
    } catch (error) {
      if (error.code === 'ENOENT') return [];
      throw error;
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = new FileService();