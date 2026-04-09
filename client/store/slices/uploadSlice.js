import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
 
import { toast } from 'react-hot-toast';
import API from '../api';

// --- Async Thunks ---

// 1. Single File Upload
export const uploadSingleFile = createAsyncThunk(
  'upload/single',
  async ({ file, folder }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const config = {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }
      };

      const response = await API.post(`/upload/single`, formData, config);
      toast.success('File uploaded successfully!');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
      return rejectWithValue(error.response.data);
    }
  }
);

// 2. Multiple Files Upload (e.g., Hospital Gallery)
export const uploadMultipleFiles = createAsyncThunk(
  'upload/multiple',
  async ({ files, folder }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      formData.append('folder', folder);

      const config = {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('token')}` 
        }
      };

      const response = await API.post(`/upload/multiple`, formData, config);
      toast.success(`${files.length} files uploaded!`);
      return response.data; // Array of ImageKit results
    } catch (error) {
      toast.error(error.response?.data?.message || 'Bulk upload failed');
      return rejectWithValue(error.response.data);
    }
  }
);

// --- The Slice ---

const uploadSlice = createSlice({
  name: 'upload',
  initialState: {
    lastUploadedUrl: null,
    galleryUrls: [],
    isUploading: false,
    error: null,
  },
  reducers: {
    resetUploadState: (state) => {
      state.lastUploadedUrl = null;
      state.galleryUrls = [];
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Single Upload Cases
      .addCase(uploadSingleFile.pending, (state) => {
        state.isUploading = true;
      })
      .addCase(uploadSingleFile.fulfilled, (state, action) => {
        state.isUploading = false;
        state.lastUploadedUrl = action.payload.url;
      })
      .addCase(uploadSingleFile.rejected, (state, action) => {
        state.isUploading = false;
        state.error = action.payload?.message;
      })
      // Multiple Upload Cases
      .addCase(uploadMultipleFiles.pending, (state) => {
        state.isUploading = true;
      })
      .addCase(uploadMultipleFiles.fulfilled, (state, action) => {
        state.isUploading = false;
        state.galleryUrls = action.payload.data.map(file => file.url);
      })
      .addCase(uploadMultipleFiles.rejected, (state, action) => {
        state.isUploading = false;
        state.error = action.payload?.message;
      });
  }
});

export const { resetUploadState } = uploadSlice.actions;
export default uploadSlice.reducer;