import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Button, IconButton, Typography, CircularProgress } from '@mui/material';
import { CameraAlt, FlipCameraAndroid, PhotoLibrary, Close } from '@mui/icons-material';

interface PinchZoomCameraProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

const PinchZoomCamera: React.FC<PinchZoomCameraProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const pointerCache = useRef<PointerEvent[]>([]);
  const lastPinchDist = useRef<number>(-1);

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setLoading(true);
    setError('');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setError('카메라 접근 권한이 필요합니다. 브라우저 설정에서 카메라를 허용해주세요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const flipCamera = () => {
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    startCamera(next);
  };

  // Pinch zoom handlers
  const onPointerDown = (e: React.PointerEvent) => {
    pointerCache.current.push(e.nativeEvent);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const idx = pointerCache.current.findIndex((pe) => pe.pointerId === e.pointerId);
    if (idx >= 0) pointerCache.current[idx] = e.nativeEvent;

    if (pointerCache.current.length === 2) {
      const [p1, p2] = pointerCache.current;
      const dist = Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
      if (lastPinchDist.current > 0) {
        const delta = dist / lastPinchDist.current;
        setZoom((prev) => Math.min(Math.max(prev * delta, 1), 4));
      }
      lastPinchDist.current = dist;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointerCache.current = pointerCache.current.filter((pe) => pe.pointerId !== e.pointerId);
    if (pointerCache.current.length < 2) lastPinchDist.current = -1;
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Apply zoom crop
    const cropW = w / zoom;
    const cropH = h / zoom;
    const cropX = (w - cropW) / 2;
    const cropY = (h - cropH) / 2;
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, w, h);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `receipt_${Date.now()}.jpg`, { type: 'image/jpeg' });
          onCapture(file);
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
  };

  return (
    <Box
      sx={{
        position: 'fixed', inset: 0, bgcolor: 'black', zIndex: 2000,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, zIndex: 1 }}>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <Close />
        </IconButton>
        <Typography variant="body2" sx={{ color: 'white', alignSelf: 'center' }}>
          두 손가락으로 확대/축소 · 배율 {zoom.toFixed(1)}x
        </Typography>
        <IconButton onClick={flipCamera} sx={{ color: 'white' }}>
          <FlipCameraAndroid />
        </IconButton>
      </Box>

      <Box
        sx={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress sx={{ color: 'white' }} />
          </Box>
        )}
        {error && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
            <Typography color="error" textAlign="center">{error}</Typography>
          </Box>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => setLoading(false)}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            transform: `scale(${zoom})`, transformOrigin: 'center',
          }}
        />
        {/* 가이드 프레임 */}
        <Box sx={{
          position: 'absolute', inset: '10%',
          border: '2px solid rgba(255,255,255,0.6)',
          borderRadius: 2, pointerEvents: 'none',
        }} />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', p: 3, pb: 4 }}>
        <IconButton
          onClick={() => fileInputRef.current?.click()}
          sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.15)', p: 1.5 }}
        >
          <PhotoLibrary fontSize="large" />
        </IconButton>
        <IconButton
          onClick={capture}
          disabled={loading || !!error}
          sx={{
            bgcolor: 'white', width: 72, height: 72,
            '&:hover': { bgcolor: '#f5f5f5' },
            '&:disabled': { bgcolor: 'grey.400' },
          }}
        >
          <CameraAlt sx={{ fontSize: 36, color: 'primary.main' }} />
        </IconButton>
        <Box sx={{ width: 48 }} />
      </Box>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </Box>
  );
};

export default PinchZoomCamera;
