import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Alert,
  Button,
  TextField,
  InputAdornment,
  Grid,
  Paper,
  CircularProgress,
  Stack,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Download as DownloadIcon,
  ContentCopy as ContentCopyIcon,
  Link as LinkIcon,
} from '@mui/icons-material';

function JobStatus({ jobId, shareLink }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;

    const fetchJobStatus = async () => {
      try {
        const response = await axios.get(`/api/jobs/${jobId}`);
        if (!isMounted) return;

        setJob(response.data);
        setError('');
        setLoading(false);

        // If job is still in progress, poll for updates
        if (response.data.status !== 'completed' && response.data.status !== 'failed') {
          timeoutId = setTimeout(fetchJobStatus, 2000); // Poll every 2 seconds
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.response?.data?.error || 'Failed to fetch job status');
        setLoading(false);
      }
    };

    fetchJobStatus();

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [jobId]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = job.zipUrl;
    link.download = 'scraped-documents.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && !job) {
    return (
      <Card elevation={3}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Loading job status...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (!job) {
    return null;
  }

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        label: 'Pending',
        color: 'default',
        icon: <HourglassEmptyIcon />,
      },
      crawling: {
        label: 'Crawling Website',
        color: 'info',
        icon: <HourglassEmptyIcon />,
      },
      processing: {
        label: 'Generating Documents',
        color: 'info',
        icon: <HourglassEmptyIcon />,
      },
      completed: {
        label: 'Completed',
        color: 'success',
        icon: <CheckCircleIcon />,
      },
      failed: {
        label: 'Failed',
        color: 'error',
        icon: <ErrorIcon />,
      },
    };
    return configs[status] || configs.pending;
  };

  const statusConfig = getStatusConfig(job.status);

  return (
    <Card elevation={3}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
          Job Status
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontFamily: 'monospace', mb: 3 }}
        >
          Job ID: {jobId}
        </Typography>

        <Box sx={{ mb: 4 }}>
          <Chip
            icon={statusConfig.icon}
            label={statusConfig.label}
            color={statusConfig.color}
            sx={{ fontSize: '1rem', py: 2.5, px: 1 }}
          />
        </Box>

        {job.status !== 'failed' && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                Progress
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {job.progress}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={job.progress}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={6}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                textAlign: 'center',
                backgroundColor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Pages
              </Typography>
              <Typography variant="h4" fontWeight={600}>
                {job.totalPages || 0}
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={6}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                textAlign: 'center',
                backgroundColor: 'grey.50',
                border: '1px solid',
                borderColor: 'grey.200',
              }}
            >
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Processed
              </Typography>
              <Typography variant="h4" fontWeight={600}>
                {job.processedPages || 0}
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {job.status === 'completed' && job.zipUrl && (
          <Box sx={{ mb: 4 }}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{ py: 1.5 }}
            >
              Download Zip File
            </Button>
          </Box>
        )}

        {job.status === 'failed' && (
          <Alert severity="error" sx={{ mb: 4 }}>
            The job failed to complete. Please try again with a different URL.
          </Alert>
        )}

        <Divider sx={{ my: 4 }} />

        <Box>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Share this link:
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              value={window.location.origin + shareLink}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkIcon color="action" />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                },
              }}
            />
            <Button
              variant="outlined"
              onClick={handleCopyLink}
              startIcon={<ContentCopyIcon />}
              sx={{ minWidth: 100 }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export default JobStatus;
