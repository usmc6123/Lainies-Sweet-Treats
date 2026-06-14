import { dbService } from '../src/server/db.js';
import { setCorsHeaders, authenticateAdmin } from './_lib/helper.js';

export default async function handler(req: any, res: any) {
  if (setCorsHeaders(req, res)) return;

  try {
    if (req.method === 'GET') {
      const settings = await dbService.getSettings();
      return res.status(200).json(settings);
    }

    if (req.method === 'POST') {
      const adminUser = authenticateAdmin(req, res);
      if (!adminUser) return; // Response is already handled by authenticateAdmin helper

      const updatedSettings = await dbService.saveSettings(req.body);
      return res.status(200).json(updatedSettings);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('Settings API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
