import React, { useState } from 'react';
import {
  Box, Button, Typography, CircularProgress, Alert,
  Card, CardActionArea, CardContent,
} from '@mui/material';
import { CameraAlt, PhotoLibrary, EditNote, ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import PinchZoomCamera from '../components/PinchZoomCamera';
import { receiptsApi } from '../api/client';
import type { Category } from '../types';
import { useCategories } from '../contexts/CategoriesContext';

type Step = 'category' | 'method';

const ReceiptCapturePage: React.FC = () => {
  const navigate = useNavigate();
  const { categories, labelOf } = useCategories();
  const [step, setStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelectCategory = (cat: Category) => {
    setSelectedCategory(cat);
    setStep('method');
  };

  const handleCapture = async (file: File) => {
    setShowCamera(false);
    setLoading(true);
    setError('');
    try {
      const res = await receiptsApi.analyze(file);
      navigate('/receipt-review', {
        state: {
          analyzed: res.data,
          presetCategory: selectedCategory,
        },
      });
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

  const handleManualEntry = () => {
    navigate('/receipt-manual', { state: { presetCategory: selectedCategory } });
  };

  // 카메라 전체화면
  if (showCamera) {
    return <PinchZoomCamera onCapture={handleCapture} onClose={() => setShowCamera(false)} />;
  }

  // AI 분석 중
  if (loading) {
    return (
      <Layout title="영수증 등록" showBack>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 2 }}>
          <CircularProgress size={56} />
          <Typography variant="h6" fontWeight={600}>AI 분석 중...</Typography>
          <Typography variant="body2" color="text.secondary">영수증 내용을 추출하고 있습니다</Typography>
        </Box>
      </Layout>
    );
  }

  // Step 1: 용도 선택
  if (step === 'category') {
    return (
      <Layout title="용도 선택" showBack>
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            어떤 용도로 사용하셨나요?
          </Typography>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {categories.map((cat) => (
              <Box key={cat.id} sx={{ width: 'calc(50% - 6px)' }}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.50', boxShadow: 1 },
                  }}
                >
                  <CardActionArea onClick={() => handleSelectCategory(cat.id as Category)}>
                    <CardContent sx={{ py: 1.2, px: 1.5, '&:last-child': { pb: 1.2 } }}>
                      <Typography variant="body2" fontWeight={700}>
                        {cat.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {cat.description}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Box>
            ))}
          </Box>
        </Box>
      </Layout>
    );
  }

  // Step 2: 등록 방법 선택
  return (
    <Layout title="등록 방법 선택" showBack>
      <Box sx={{ p: 2 }}>
        {/* 선택된 용도 표시 */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, p: 2, bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'primary.200' }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary">선택된 용도</Typography>
            <Typography variant="subtitle1" fontWeight={700}>
              {selectedCategory && labelOf(selectedCategory)}
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<ArrowBack />}
            onClick={() => setStep('category')}
            sx={{ ml: 'auto' }}
          >
            변경
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          영수증을 어떻게 등록하시겠어요?
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* 카메라 촬영 */}
        <Card
          variant="outlined"
          sx={{ mb: 1.5, borderRadius: 2, '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
        >
          <CardActionArea onClick={() => setShowCamera(true)} sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CameraAlt sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>카메라로 촬영</Typography>
                <Typography variant="caption" color="text.secondary">
                  영수증·키오스크·결제 화면 사진 촬영
                </Typography>
              </Box>
            </Box>
          </CardActionArea>
        </Card>

        {/* 갤러리 선택 */}
        <Card
          variant="outlined"
          sx={{ mb: 1.5, borderRadius: 2, '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
          component="label"
        >
          <CardActionArea component="span" sx={{ p: 2.5, display: 'block', cursor: 'pointer' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PhotoLibrary sx={{ fontSize: 40, color: 'secondary.main' }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>갤러리에서 선택</Typography>
                <Typography variant="caption" color="text.secondary">
                  저장된 사진으로 AI 분석
                </Typography>
              </Box>
            </Box>
            <input type="file" accept="image/*" hidden onChange={handleFileInput} />
          </CardActionArea>
        </Card>

        {/* 직접 입력 */}
        <Card
          variant="outlined"
          sx={{ mb: 3, borderRadius: 2, '&:hover': { borderColor: 'success.main', boxShadow: 2 } }}
        >
          <CardActionArea onClick={handleManualEntry} sx={{ p: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <EditNote sx={{ fontSize: 40, color: 'success.main' }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>직접 입력</Typography>
                <Typography variant="caption" color="text.secondary">
                  영수증 없이 금액·내역 직접 입력
                </Typography>
              </Box>
            </Box>
          </CardActionArea>
        </Card>

        <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
          두 손가락으로 카메라 확대/축소 가능 · 영수증 전체가 잘 보이도록 촬영하세요
        </Typography>
      </Box>
    </Layout>
  );
};

export default ReceiptCapturePage;
