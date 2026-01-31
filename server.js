const express = require('express');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10mb' }));

// API-nøkkel for autentisering
const API_KEY = process.env.LATEX_API_KEY;

// Middleware for logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// LaTeX kompilering
app.post('/compile', (req, res) => {
  // Valider API-nøkkel
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${API_KEY}`) {
    console.error('Unauthorized request');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { latex } = req.body;
  
  if (!latex) {
    return res.status(400).json({ error: 'No LaTeX content provided' });
  }

  const jobId = crypto.randomUUID();
  const workDir = path.join('/tmp', 'latex-jobs', jobId);
  
  console.log(`Starting job ${jobId}`);
  
  try {
    // Opprett arbeidskatalog
    fs.mkdirSync(workDir, { recursive: true });
    
    // Skriv LaTeX-fil
    const texFile = path.join(workDir, 'document.tex');
    fs.writeFileSync(texFile, latex);
    
    // Kompiler med pdflatex (to ganger for referanser)
    console.log(`Compiling job ${jobId}...`);
    
    try {
      execSync(`cd "${workDir}" && pdflatex -interaction=nonstopmode -halt-on-error document.tex`, {
        timeout: 30000,
        stdio: 'pipe'
      });
    } catch (firstPassError) {
      // Første pass kan feile, prøv igjen
      console.log('First pass had warnings, continuing...');
    }
    
    execSync(`cd "${workDir}" && pdflatex -interaction=nonstopmode document.tex`, {
      timeout: 30000,
      stdio: 'pipe'
    });
    
    // Les PDF
    const pdfFile = path.join(workDir, 'document.pdf');
    
    if (!fs.existsSync(pdfFile)) {
      throw new Error('PDF was not generated');
    }
    
    const pdfBuffer = fs.readFileSync(pdfFile);
    
    console.log(`Job ${jobId} completed, PDF size: ${pdfBuffer.length} bytes`);
    
    // Rydd opp
    fs.rmSync(workDir, { recursive: true });
    
    // Send PDF
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="cv.pdf"');
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error.message);
    
    // Les log-fil for debugging
    let logContent = '';
    try {
      const logFile = path.join(workDir, 'document.log');
      if (fs.existsSync(logFile)) {
        logContent = fs.readFileSync(logFile, 'utf8');
        // Finn feilmeldinger
        const errorLines = logContent.split('\n').filter(line => 
          line.includes('!') || line.includes('Error')
        ).slice(0, 10).join('\n');
        console.error('LaTeX errors:', errorLines);
      }
    } catch (logError) {
      // Ignorer log-lesefeil
    }
    
    // Rydd opp ved feil
    if (fs.existsSync(workDir)) {
      try {
        fs.rmSync(workDir, { recursive: true });
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError.message);
      }
    }
    
    res.status(500).json({ 
      error: 'Compilation failed',
      message: error.message,
      jobId
    });
  }
});

// Rydde opp gamle jobber periodisk
setInterval(() => {
  const jobsDir = path.join('/tmp', 'latex-jobs');
  if (fs.existsSync(jobsDir)) {
    const jobs = fs.readdirSync(jobsDir);
    const now = Date.now();
    
    jobs.forEach(job => {
      const jobPath = path.join(jobsDir, job);
      try {
        const stats = fs.statSync(jobPath);
        // Slett jobber eldre enn 1 time
        if (now - stats.mtimeMs > 3600000) {
          fs.rmSync(jobPath, { recursive: true });
          console.log(`Cleaned up old job: ${job}`);
        }
      } catch (error) {
        // Ignorer feil
      }
    });
  }
}, 600000); // Kjør hvert 10. minutt

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`LaTeX service running on port ${PORT}`);
  console.log(`API Key configured: ${API_KEY ? 'Yes' : 'No'}`);
});
