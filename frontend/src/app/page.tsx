"use client";
import React, { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export default function Dashboard() {
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    resume: null
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/profiles`);
      if (!res.ok) throw new Error('Failed to fetch profiles');
      const data = await res.json();
      setProfiles(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit');
        return;
      }
      const ext = file.name.split('.').pop().toLowerCase();
      if (!['pdf', 'docx'].includes(ext)) {
        alert('Only PDF and DOCX files are allowed');
        return;
      }
      setFormData({ ...formData, resume: file });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);
    setUploadProgress(0);

    const data = new FormData();
    data.append('name', formData.name);
    data.append('category', formData.category);
    data.append('resume', formData.resume);

    try {
      const response = await fetch(`${API_BASE_URL}/profiles`, {
        method: 'POST',
        body: data,
      });

      if (!response.ok) throw new Error('Upload failed');

      await fetchProfiles();
      setIsAdding(false);
      setFormData({ name: '', category: '', resume: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteProfile = async (id) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;
    try {
      await fetch(`${API_BASE_URL}/profiles/${id}`, { method: 'DELETE' });
      await fetchProfiles();
      if (selectedProfileId === id) setSelectedProfileId(null);
    } catch (err) {
      setError('Failed to delete profile');
    }
  };

  const triggerSearch = async () => {
    if (!selectedProfileId) {
      alert('Please select a profile first');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedProfileId, settings: { targetApplicationsCount: 5 } }),
      });
      const data = await res.json();
      alert(data.message || 'Search started!');
    } catch (err) {
      alert('Search failed to start');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans text-slate-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Recruiter Outreach</h1>
            <p className="text-slate-500">Manage candidate profiles and automate outreach</p>
          </div>
          <button
            onClick={() => setIsAdding(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
          >
            + Add Profile
          </button>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* Active Profile Status */}
        <div className="mb-8 p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${selectedProfileId ? 'bg-green-500' : 'bg-slate-300'}`} />
            <span className="text-sm font-medium text-slate-600">
              Active Profile: {selectedProfileId ? profiles.find(p => p.id === selectedProfileId)?.name : 'None Selected'}
            </span>
          </div>
          <button
            onClick={triggerSearch}
            disabled={!selectedProfileId}
            className="bg-navy-900 bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-700 transition-colors"
          >
            Start Search & Outreach
          </button>
        </div>

        {/* Profiles Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-400">Loading profiles...</div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
            No profiles found. Create one to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map(profile => (
              <div
                key={profile.id}
                className={`p-6 bg-white border rounded-xl shadow-sm transition-all cursor-pointer ${selectedProfileId === profile.id ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-200 hover:border-slate-300'}`}
                onClick={() => setSelectedProfileId(profile.id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-bold text-slate-800">{profile.name}</h3>
                  <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-600 rounded-full">
                    {profile.category}
                  </span>
                </div>
                <div className="text-sm text-slate-500 mb-6">
                  <p className="truncate">📄 {profile.resumeName}</p>
                  <p className="text-xs mt-1">Updated: {new Date(profile.updatedAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteProfile(profile.id); }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium p-1"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Profile Modal */}
        {isAdding && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Create Candidate Profile</h2>
                <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Job Profile / Category *</label>
                  <select
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all bg-white"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="">Select a profile...</option>
                    <option value="Frontend / Web Development">Frontend / Web Development</option>
                    <option value="Backend / Java">Backend / Java</option>
                    <option value="Full Stack">Full Stack</option>
                    <option value="Data Engineering / Analytics">Data Engineering / Analytics</option>
                    <option value="QA / Testing">QA / Testing</option>
                    <option value="DevOps / Cloud">DevOps / Cloud</option>
                    <option value="Mobile Development">Mobile Development</option>
                    <option value=".NET">.NET</option>
                    <option value="Other / Custom">Other / Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Resume (PDF, DOCX) *</label>
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-teal-500 transition-colors cursor-pointer relative group"
                    onClick={() => document.getElementById('resume-upload').click()}
                  >
                    <input
                      id="resume-upload"
                      type="file"
                      hidden
                      accept=".pdf,.docx"
                      onChange={handleFileChange}
                    />
                    <div className="text-slate-400 group-hover:text-teal-600 transition-colors">
                      <p className="text-sm font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs mt-1">Max size 10MB</p>
                    </div>
                    {formData.resume && (
                      <div className="mt-4 p-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium flex items-center justify-between">
                        <span className="truncate max-w-[80%]">{formData.resume.name}</span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFormData({...formData, resume: null}); }}
                          className="text-teal-800 hover:text-red-500 ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-semibold disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
