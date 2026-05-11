const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const simpleGit = require('simple-git');

const app = express();
const port = process.env.PORT || 3001;
let workDir = process.cwd();
let git = simpleGit(workDir);

app.use(cors());
app.use(express.json());

// Helper function to build a file tree
async function buildTree(dir) {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const nodes = [];

  for (const dirent of dirents) {
    if (dirent.name === 'node_modules' || dirent.name === '.git') continue;

    const fullPath = path.join(dir, dirent.name);
    const relativePath = path.relative(workDir, fullPath);

    if (dirent.isDirectory()) {
      nodes.push({
        name: dirent.name,
        path: relativePath,
        type: 'directory',
        children: await buildTree(fullPath)
      });
    } else {
      nodes.push({
        name: dirent.name,
        path: relativePath,
        type: 'file'
      });
    }
  }
  
  // Sort directories first, then alphabetically
  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

// Get the entire file tree
app.get('/api/files', async (req, res) => {
  try {
    const tree = await buildTree(workDir);
    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Read file contents
app.get('/api/file', async (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Path is required' });
    
    const fullPath = path.join(workDir, filePath);
    // Prevent directory traversal
    if (!fullPath.startsWith(workDir)) return res.status(403).json({ error: 'Access denied' });
    
    const content = await fs.readFile(fullPath, 'utf-8');
    res.send(content);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Write file contents
app.post('/api/file', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) return res.status(400).json({ error: 'Path and content are required' });
    
    const fullPath = path.join(workDir, filePath);
    if (!fullPath.startsWith(workDir)) return res.status(403).json({ error: 'Access denied' });
    
    await fs.writeFile(fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Git status
app.get('/api/git/status', async (req, res) => {
  try {
    const status = await git.status();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Git add and commit
app.post('/api/git/commit', async (req, res) => {
  try {
    const { message, files } = req.body;
    if (!message) return res.status(400).json({ error: 'Commit message is required' });
    
    if (files && files.length > 0) {
      await git.add(files);
    } else {
      await git.add('.');
    }
    
    const commitResult = await git.commit(message);
    res.json({ success: true, result: commitResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current working directory
app.get('/api/current-folder', (req, res) => {
  res.json({ path: workDir });
});

// Change working directory (open folder)
app.post('/api/open-folder', async (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath) return res.status(400).json({ error: 'Folder path is required' });
    
    // Verify directory exists
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }
    
    workDir = path.resolve(folderPath);
    git = simpleGit(workDir);
    
    console.log(`Working directory changed to: ${workDir}`);
    res.json({ success: true, path: workDir });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
  console.log(`Serving directory: ${workDir}`);
});
