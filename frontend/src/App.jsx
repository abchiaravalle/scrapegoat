import { useState, useEffect } from 'react';
import axios from 'axios';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Container, AppBar, Toolbar, Typography, Box, IconButton } from '@mui/material';
import { Web as WebIcon, Logout as LogoutIcon } from '@mui/icons-material';
import theme from './theme';
import UrlForm from './components/UrlForm';
import JobStatus from './components/JobStatus';
import Login from './components/Login';

// Configure axios to send credentials with all requests
axios.defaults.withCredentials = true;

function App() {
  const [jobId, setJobId] = useState(null);
  const [shareLink, setShareLink] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Check if we're on a job page
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/job\/([a-f0-9-]+)/);
    if (match) {
      setJobId(match[1]);
      setShareLink(path);
    }
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/auth/me', { withCredentials: true });
      if (response.data.authenticated) {
        setAuthenticated(true);
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = (userData) => {
    setAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout', {}, { withCredentials: true });
      setAuthenticated(false);
      setUser(null);
      setJobId(null);
      setShareLink(null);
      window.history.pushState({}, '', '/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleJobCreated = (newJobId, newShareLink) => {
    setJobId(newJobId);
    setShareLink(newShareLink);
    window.history.pushState({}, '', newShareLink);
  };

  if (checkingAuth) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <Typography>Loading...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  if (!authenticated) {
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
            </Toolbar>
          </AppBar>
          <Container maxWidth="sm" sx={{ py: 4, flex: 1, display: 'flex', alignItems: 'center' }}>
            <Login onLogin={handleLogin} />
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

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
            <Typography variant="body2" sx={{ opacity: 0.9, mr: 2 }}>
              {user?.username}
            </Typography>
            <IconButton color="inherit" onClick={handleLogout} title="Logout">
              <LogoutIcon />
            </IconButton>
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
