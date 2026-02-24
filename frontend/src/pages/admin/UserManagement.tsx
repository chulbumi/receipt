import React, { useEffect, useState } from 'react';
import {
  Box, Card, Table, TableBody, TableCell, TableHead, TableRow,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, IconButton, Alert, CircularProgress, Tabs, Tab,
  Typography, Badge,
} from '@mui/material';
import { Add, Edit, Check, Close, PersonOff, HowToReg } from '@mui/icons-material';
import Layout from '../../components/Layout';
import { adminApi } from '../../api/client';

interface UserItem {
  user_id: string;
  name: string;
  department: string;
  role: string;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: '활성',
  pending: '승인대기',
  inactive: '비활성',
};

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success',
  pending: 'warning',
  inactive: 'default',
};

const UserManagement: React.FC = () => {
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0); // 0=전체, 1=승인대기, 2=활성, 3=비활성
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<UserItem | null>(null);

  const [formUserId, setFormUserId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formRole, setFormRole] = useState('user');
  const [formPassword, setFormPassword] = useState('');
  const [formStatus, setFormStatus] = useState('active');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers();
      setAllUsers(res.data.users);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const tabFiltered = () => {
    switch (tab) {
      case 1: return allUsers.filter((u) => u.status === 'pending');
      case 2: return allUsers.filter((u) => u.status === 'active');
      case 3: return allUsers.filter((u) => u.status === 'inactive');
      default: return allUsers;
    }
  };

  const pendingCount = allUsers.filter((u) => u.status === 'pending').length;

  const openCreate = () => {
    setFormUserId(''); setFormName(''); setFormDept(''); setFormRole('user');
    setFormPassword(''); setFormStatus('active'); setError('');
    setDialog('create');
  };

  const openEdit = (u: UserItem) => {
    setSelected(u);
    setFormName(u.name); setFormDept(u.department); setFormRole(u.role);
    setFormPassword(''); setFormStatus(u.status || 'active'); setError('');
    setDialog('edit');
  };

  const handleSave = async () => {
    if (dialog === 'create' && (!formUserId || !formName || !formPassword)) {
      setError('아이디, 이름, 비밀번호는 필수입니다.'); return;
    }
    setSaving(true);
    try {
      if (dialog === 'create') {
        await adminApi.createUser({
          user_id: formUserId, name: formName, department: formDept,
          role: formRole, password: formPassword,
        });
      } else if (dialog === 'edit' && selected) {
        const data: any = { name: formName, department: formDept, role: formRole, status: formStatus };
        if (formPassword) data.password = formPassword;
        await adminApi.updateUser(selected.user_id, data);
      }
      setDialog(null);
      load();
    } catch (err: any) {
      setError(err.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (u: UserItem) => {
    if (!window.confirm(`${u.name}(${u.user_id}) 계정을 승인하시겠습니까?`)) return;
    setActionLoading(u.user_id);
    try {
      await adminApi.approveUser(u.user_id);
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (u: UserItem) => {
    if (!window.confirm(`${u.name}(${u.user_id}) 가입을 반려하시겠습니까?`)) return;
    setActionLoading(u.user_id);
    try {
      await adminApi.rejectUser(u.user_id);
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (u: UserItem) => {
    const toStatus = u.status === 'active' ? 'inactive' : 'active';
    const label = toStatus === 'inactive' ? '비활성화' : '활성화';
    if (!window.confirm(`${u.name} 계정을 ${label}하시겠습니까?`)) return;
    setActionLoading(u.user_id);
    try {
      await adminApi.updateUser(u.user_id, { status: toStatus });
      await load();
    } finally {
      setActionLoading(null);
    }
  };

  const users = tabFiltered();

  return (
    <Layout title="사용자 관리" showBack>
      <Box sx={{ p: 2 }}>
        <Box display="flex" justifyContent="flex-end" mb={2}>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            사용자 추가
          </Button>
        </Box>

        {pendingCount > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            승인 대기 중인 계정이 <strong>{pendingCount}개</strong> 있습니다.
          </Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
          <Tab label={`전체 (${allUsers.length})`} />
          <Tab
            label={
              <Badge badgeContent={pendingCount} color="error" invisible={pendingCount === 0}>
                <Typography variant="body2" sx={{ pr: pendingCount > 0 ? 1.5 : 0 }}>승인 대기</Typography>
              </Badge>
            }
          />
          <Tab label={`활성 (${allUsers.filter((u) => u.status === 'active').length})`} />
          <Tab label={`비활성 (${allUsers.filter((u) => u.status === 'inactive').length})`} />
        </Tabs>

        <Card>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>아이디</TableCell>
                <TableCell>이름</TableCell>
                <TableCell>부서</TableCell>
                <TableCell>권한</TableCell>
                <TableCell>상태</TableCell>
                <TableCell align="right">작업</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={24} />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    해당 사용자가 없습니다.
                  </TableCell>
                </TableRow>
              ) : users.map((u) => (
                <TableRow key={u.user_id} sx={{ opacity: u.status === 'inactive' ? 0.5 : 1 }}>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{u.user_id}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{u.name}</TableCell>
                  <TableCell sx={{ fontSize: '0.8rem' }}>{u.department}</TableCell>
                  <TableCell>
                    <Chip
                      label={u.role === 'admin' ? '관리자' : '일반'}
                      size="small"
                      color={u.role === 'admin' ? 'error' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={STATUS_LABELS[u.status] || u.status}
                      size="small"
                      color={STATUS_COLORS[u.status] || 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {u.status === 'pending' ? (
                      <>
                        <IconButton
                          size="small"
                          color="success"
                          title="승인"
                          disabled={actionLoading === u.user_id}
                          onClick={() => handleApprove(u)}
                        >
                          {actionLoading === u.user_id
                            ? <CircularProgress size={16} />
                            : <Check fontSize="small" />
                          }
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          title="반려"
                          disabled={actionLoading === u.user_id}
                          onClick={() => handleReject(u)}
                        >
                          <Close fontSize="small" />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <IconButton size="small" onClick={() => openEdit(u)} title="편집">
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color={u.status === 'active' ? 'warning' : 'success'}
                          title={u.status === 'active' ? '비활성화' : '활성화'}
                          disabled={actionLoading === u.user_id}
                          onClick={() => handleToggleActive(u)}
                        >
                          {actionLoading === u.user_id
                            ? <CircularProgress size={16} />
                            : u.status === 'active'
                              ? <PersonOff fontSize="small" />
                              : <HowToReg fontSize="small" />
                          }
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Box>

      <Dialog open={!!dialog} onClose={() => setDialog(null)} fullWidth>
        <DialogTitle>{dialog === 'create' ? '사용자 추가' : '사용자 편집'}</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {dialog === 'create' && (
            <TextField label="아이디" value={formUserId} onChange={(e) => setFormUserId(e.target.value)} fullWidth margin="normal" />
          )}
          <TextField label="이름" value={formName} onChange={(e) => setFormName(e.target.value)} fullWidth margin="normal" />
          <TextField label="부서" value={formDept} onChange={(e) => setFormDept(e.target.value)} fullWidth margin="normal" />
          <FormControl fullWidth margin="normal">
            <InputLabel>권한</InputLabel>
            <Select value={formRole} onChange={(e) => setFormRole(e.target.value)} label="권한">
              <MenuItem value="user">일반 사용자</MenuItem>
              <MenuItem value="admin">관리자</MenuItem>
            </Select>
          </FormControl>
          {dialog === 'edit' && (
            <FormControl fullWidth margin="normal">
              <InputLabel>계정 상태</InputLabel>
              <Select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} label="계정 상태">
                <MenuItem value="active">활성</MenuItem>
                <MenuItem value="inactive">비활성</MenuItem>
                <MenuItem value="pending">승인 대기</MenuItem>
              </Select>
            </FormControl>
          )}
          <TextField
            label={dialog === 'create' ? '비밀번호' : '새 비밀번호 (변경시만 입력)'}
            type="password"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>취소</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default UserManagement;
