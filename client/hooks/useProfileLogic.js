import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  getProfile, getActiveDevices, logoutDevice, 
  changePassword, updateProfile 
} from '@/store/slices/userSlice';
import { uploadSingleFile } from '@/store/slices/uploadSlice';
import toast from 'react-hot-toast';

export const useProfileLogic = () => {
  const dispatch = useDispatch();
  const { user, profile, activeDevices, loading } = useSelector((state) => state.user);
  const { isUploading } = useSelector((state) => state.upload);

  const fetchData = useCallback(() => {
    dispatch(getProfile());
    dispatch(getActiveDevices());
  }, [dispatch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateProfile = async (updateData) => {
    const result = await dispatch(updateProfile(updateData));
    if (result.meta.requestStatus === 'fulfilled') {
      toast.success('System Records Updated');
      fetchData(); // Refresh to ensure sync
    }
  };

  const handleImageUpload = async (file, folder = 'Profiles') => {
    const result = await dispatch(uploadSingleFile({ file, folder }));
    if (result.meta.requestStatus === 'fulfilled') {
      return result.payload.url; // Return the ImageKit URL
    }
    return null;
  };

  const handleDeviceLogout = async (tokenId) => {
    const result = await dispatch(logoutDevice(tokenId));
    if (result.meta.requestStatus === 'fulfilled') {
      toast.success('Session terminated successfully');
    }
  };

  const handlePasswordChange = async (passwords) => {
    const result = await dispatch(changePassword(passwords));
    return result.meta.requestStatus === 'fulfilled';
  };

  return { 
    user, profile, activeDevices, loading: loading || isUploading, 
    handleUpdateProfile, handleImageUpload, handleDeviceLogout, 
    handlePasswordChange, fetchData 
  };
};