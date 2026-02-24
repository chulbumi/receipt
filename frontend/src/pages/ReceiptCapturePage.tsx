import React, { useState } from 'react';
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material';
import { CameraAlt, PhotoLibrary } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import PinchZoomCamera from '../components/PinchZoomCamera';
import { receiptsApi } from '../api/client';

const ReceiptCapturePage: React.FC = () => {
  const navigate = useNavigate();
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCapture = async (file: File) => {
    setShowCamera(false);
    setLoading(true);
    setError('');
    try {
      const res = await receiptsApi.analyze(file);
      navigate('/receipt-review', { state: { analyzed: res.data } });
    } catch (err: any) {
      setError(err.response?.data?.detail || '영수증 분석에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleCapture(file);
  };

  if (showCamera) {
    return <PinchZoomCamera onCapture={handleCapture} onClose={() => setShowCamera(false)} />;
  }

  return (
    <Layout title="영수증 등록" showBack>
      <Box
        sx={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '70vh', p: 3, gap: 3,
        }}
      >
        {loading ? (
          <Box textAlign="center">
            <CircularProgress size={56} sx={{ mb: 2 }} />
            <Typography variant="h6" fontWeight={600}>AI 분석 중...</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              영수증 내용을 추출하고 있습니다
            </Typography>
          </Box>
        ) : (
          <>
            <Box textAlign="center">
              <CameraAlt sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" fontWeight={700} gutterBottom>
                영수증을 촬영하세요
              </Typography>
              <Typography variant="body2" color="text.secondary">
                AI가 자동으로 내용을 추출합니다
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>
            )}

            <Button
              variant="contained"
              size="large"
              startIcon={<CameraAlt />}
              onClick={() => setShowCamera(true)}
              sx={{ width: '100%', py: 2, fontSize: 18 }}
            >
              카메라로 촬영
            </Button>

            <Button
              variant="outlined"
              size="large"
              startIcon={<PhotoLibrary />}
              component="label"
              sx={{ width: '100%', py: 1.5 }}
            >
              갤러리에서 선택
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={handleFileInput}
              />
            </Button>

            <Typography variant="caption" color="text.secondary" textAlign="center">
              영수증 전체가 잘 보이도록 촬영해주세요{'\n'}
              두 손가락으로 확대/축소 가능
            </Typography>
          </>
        )}
      </Box>
    </Layout>
  );
};

export default ReceiptCapturePage;
