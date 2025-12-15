import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';

function JobsList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/jobs', { withCredentials: true });
      setJobs(response.data.jobs || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    // Poll for updates every 5 seconds if there are jobs in progress
    const hasInProgress = jobs.some(job => 
      job.status !== 'completed' && job.status !== 'failed'
    );
    
    if (!hasInProgress) return;
    
    const interval = setInterval(() => {
      fetchJobs();
    }, 5000);

    return () => clearInterval(interval);
  }, [jobs]);

  const handleDownload = (jobId, zipUrl) => {
    const link = document.createElement('a');
    link.href = zipUrl;
    link.download = `scrapegoat-job-${jobId}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = (jobId) => {
    const shareLink = `${window.location.origin}/job/${jobId}`;
    navigator.clipboard.writeText(shareLink);
    setCopiedId(jobId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleViewJob = (jobId) => {
    window.location.href = `/job/${jobId}`;
  };

  const getStatusConfig = (status) => {
    const configs = {
      pending: {
        label: 'Pending',
        color: 'default',
        icon: <HourglassEmptyIcon />,
      },
      crawling: {
        label: 'Crawling',
        color: 'info',
        icon: <HourglassEmptyIcon />,
      },
      processing: {
        label: 'Processing',
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

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading && jobs.length === 0) {
    return (
      <Card elevation={3}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            Loading your jobs...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card elevation={3}>
        <CardContent sx={{ p: 4 }}>
          <Alert severity="error" action={
            <Button color="inherit" size="small" onClick={fetchJobs}>
              Retry
            </Button>
          }>
            {error}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={3}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 600 }}>
            My Scraping Jobs
          </Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchJobs} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {jobs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No jobs yet. Create your first scraping job to get started!
            </Typography>
          </Box>
        ) : (
          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'grey.200' }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'grey.50' }}>
                  <TableCell><strong>URL</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Progress</strong></TableCell>
                  <TableCell><strong>Pages</strong></TableCell>
                  <TableCell><strong>Created</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((job) => {
                  const statusConfig = getStatusConfig(job.status);
                  return (
                    <TableRow key={job.id} hover>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                          }}
                          title={job.url}
                        >
                          {job.url}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={statusConfig.icon}
                          label={statusConfig.label}
                          color={statusConfig.color}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 150 }}>
                        {job.status !== 'failed' && job.status !== 'completed' ? (
                          <Box>
                            <LinearProgress
                              variant="determinate"
                              value={job.progress}
                              sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {job.progress}%
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {job.progress}%
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.processedPages || 0} / {job.totalPages || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(job.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Tooltip title="View Details">
                            <IconButton
                              size="small"
                              onClick={() => handleViewJob(job.id)}
                              color="primary"
                            >
                              <LinkIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Copy Share Link">
                            <IconButton
                              size="small"
                              onClick={() => handleCopyLink(job.id)}
                              color={copiedId === job.id ? 'success' : 'default'}
                            >
                              <ContentCopyIcon />
                            </IconButton>
                          </Tooltip>
                          {job.zipUrl && (
                            <Tooltip title="Download">
                              <IconButton
                                size="small"
                                onClick={() => handleDownload(job.id, job.zipUrl)}
                                color="primary"
                              >
                                <DownloadIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}

export default JobsList;

