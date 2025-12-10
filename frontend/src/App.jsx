import { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Container, AppBar, Toolbar, Typography, Box } from '@mui/material';
import { Web as WebIcon } from '@mui/icons-material';
import theme from './theme';
import UrlForm from './components/UrlForm';
import JobStatus from './components/JobStatus';

function App() {
  const [jobId, setJobId] = useState(null);
  const [shareLink, setShareLink] = useState(null);

  // Check if we're on a job page
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/job\/([a-f0-9-]+)/);
    if (match) {
      setJobId(match[1]);
      setShareLink(path);
    }
  }, []);

  const handleJobCreated = (newJobId, newShareLink) => {
    setJobId(newJobId);
    setShareLink(newShareLink);
    window.history.pushState({}, '', newShareLink);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static" elevation={2} sx={{ backgroundColor: 'primary.main' }}>
          <Toolbar>
            <WebIcon sx={{ mr: 2 }} />
            <Typography variant="h5" component="h1" sx={{ flexGrow: 1, fontWeight: 600 }}>
              ScrapeGoat
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Web Scraping & Document Generator
            </Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="md" sx={{ py: 4, flex: 1 }}>
          {jobId ? (
            <JobStatus jobId={jobId} shareLink={shareLink} />
          ) : (
            <UrlForm onJobCreated={handleJobCreated} />
          )}
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
