import React, { useState } from 'react';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  FormControlLabel, Checkbox, CircularProgress, InputAdornment, IconButton,
  Divider, Alert,
} from '@mui/material';
import { Visibility, VisibilityOff, ReceiptLong, PersonAdd } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { authApi } from '../api/client';

type PageMode = 'login' | 'signup';

const LoginPage: React.FC = () => {
  const [mode, setMode] = useState<PageMode>('login');

  // 로그인 필드
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);

  // 회원가입 필드
  const [signupId, setSignupId] = useState('');
  const [signupPw, setSignupPw] = useState('');
  const [signupPwConfirm, setSignupPwConfirm] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupDept, setSignupDept] = useState('');
  const [showSignupPw, setShowSignupPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력하세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(userId.trim(), password, remember);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupId.trim() || !signupPw.trim() || !signupName.trim()) {
      setError('아이디, 비밀번호, 이름은 필수입니다.');
      return;
    }
    if (signupPw !== signupPwConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (signupPw.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authApi.signup({
        user_id: signupId.trim(),
        password: signupPw,
        name: signupName.trim(),
        department: signupDept.trim(),
      });
      setSuccessMsg('가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.');
      setMode('login');
      setSignupId(''); setSignupPw(''); setSignupPwConfirm('');
      setSignupName(''); setSignupDept('');
    } catch (err: any) {
      setError(err.response?.data?.detail || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: PageMode) => {
    setMode(m);
    setError('');
    setSuccessMsg('');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={3}>
            <ReceiptLong sx={{ fontSize: 56, color: 'primary.main' }} />
            <Typography variant="h5" fontWeight={700} mt={1}>
              영수증 관리
            </Typography>
            <Typography variant="body2" color="text.secondary">
              법인카드 사용내역 관리 시스템
            </Typography>
          </Box>

          {successMsg && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {successMsg}
            </Alert>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLogin}>
              <TextField
                label="아이디"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                fullWidth
                margin="normal"
                autoComplete="username"
                autoFocus
                disabled={loading}
                inputProps={{ style: { fontSize: 16 } }}
              />
              <TextField
                label="비밀번호"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                margin="normal"
                autoComplete="current-password"
                disabled={loading}
                inputProps={{ style: { fontSize: 16 } }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPw(!showPw)} edge="end">
                        {showPw ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {error && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {error}
                </Typography>
              )}

              <FormControlLabel
                control={
                  <Checkbox
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    color="primary"
                  />
                }
                label="로그인 유지"
                sx={{ mt: 1 }}
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ mt: 2, py: 1.5, fontSize: 16 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : '로그인'}
              </Button>

              <Divider sx={{ my: 2 }} />

              <Button
                variant="outlined"
                fullWidth
                startIcon={<PersonAdd />}
                onClick={() => switchMode('signup')}
                sx={{ py: 1 }}
              >
                회원가입 신청
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignup}>
              <TextField
                label="아이디"
                value={signupId}
                onChange={(e) => setSignupId(e.target.value)}
                fullWidth
                margin="normal"
                autoFocus
                disabled={loading}
                helperText="영문·숫자 조합 권장"
                inputProps={{ style: { fontSize: 16 } }}
              />
              <TextField
                label="이름"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                fullWidth
                margin="normal"
                disabled={loading}
                inputProps={{ style: { fontSize: 16 } }}
              />
              <TextField
                label="부서"
                value={signupDept}
                onChange={(e) => setSignupDept(e.target.value)}
                fullWidth
                margin="normal"
                disabled={loading}
                inputProps={{ style: { fontSize: 16 } }}
              />
              <TextField
                label="비밀번호"
                type={showSignupPw ? 'text' : 'password'}
                value={signupPw}
                onChange={(e) => setSignupPw(e.target.value)}
                fullWidth
                margin="normal"
                disabled={loading}
                helperText="8자 이상"
                inputProps={{ style: { fontSize: 16 } }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowSignupPw(!showSignupPw)} edge="end">
                        {showSignupPw ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="비밀번호 확인"
                type={showSignupPw ? 'text' : 'password'}
                value={signupPwConfirm}
                onChange={(e) => setSignupPwConfirm(e.target.value)}
                fullWidth
                margin="normal"
                disabled={loading}
                inputProps={{ style: { fontSize: 16 } }}
              />

              {error && (
                <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                  {error}
                </Typography>
              )}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{ mt: 2, py: 1.5, fontSize: 16 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : '가입 신청'}
              </Button>

              <Divider sx={{ my: 2 }} />

              <Button
                variant="text"
                fullWidth
                onClick={() => switchMode('login')}
              >
                이미 계정이 있으신가요? 로그인
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default LoginPage;
