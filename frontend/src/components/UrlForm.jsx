import { useState } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Box,
  Alert,
  Divider,
  Stack,
  InputAdornment,
} from '@mui/material';
import {
  Link as LinkIcon,
  Code as CodeIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';

function UrlForm({ onJobCreated }) {
  const [url, setUrl] = useState('');
  const [followAllLinks, setFollowAllLinks] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);
  const [singlePageOnly, setSinglePageOnly] = useState(false);
  const [contentSelector, setContentSelector] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('/api/jobs', {
        url: url.trim(),
        email: null,
        followAllLinks: followAllLinks,
        includeImages: includeImages,
        singlePageOnly: singlePageOnly,
        contentSelector: contentSelector.trim() || null,
      });

      onJobCreated(response.data.jobId, response.data.shareLink);
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Session expired. Please refresh the page and login again.');
        // Redirect to login after a moment
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setError(err.response?.data?.error || 'Failed to create job. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card elevation={3}>
      <CardContent sx={{ p: 4 }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 1 }}>
          Start a New Scraping Job
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph sx={{ mb: 4 }}>
          Enter a URL to scrape. You can choose to crawl multiple pages or just scrape
          the single URL. The tool will extract content and generate Word documents
          organized by URL structure. Images are saved in separate folders and never
          embedded in documents.
        </Typography>

        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={3}>
            <TextField
              fullWidth
              required
              label="Website URL"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={loading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LinkIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Content Selector (optional)"
              value={contentSelector}
              onChange={(e) => setContentSelector(e.target.value)}
              placeholder="main, .content, #article, etc."
              disabled={loading}
              helperText="CSS selector to target specific content (e.g., 'main' to exclude header/footer). Leave empty to scrape entire page."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CodeIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />

            <Divider />

            <FormControlLabel
              control={
                <Checkbox
                  checked={singlePageOnly}
                  onChange={(e) => {
                    setSinglePageOnly(e.target.checked);
                    if (e.target.checked) {
                      setFollowAllLinks(false);
                    }
                  }}
                  disabled={loading}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Single page only (no crawling)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Only scrape the entered URL, don't follow any links
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={followAllLinks}
                  onChange={(e) => setFollowAllLinks(e.target.checked)}
                  disabled={loading || singlePageOnly}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Follow all links (not just same domain)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    If unchecked, only pages on the same domain will be crawled
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  disabled={loading}
                />
              }
              label={
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Include images
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Images will be saved in separate folders, never embedded in documents
                  </Typography>
                </Box>
              }
            />

            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading || !url.trim()}
              startIcon={<PlayArrowIcon />}
              sx={{ mt: 2, py: 1.5 }}
            >
              {loading ? 'Creating Job...' : 'Start Scraping'}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export default UrlForm;
