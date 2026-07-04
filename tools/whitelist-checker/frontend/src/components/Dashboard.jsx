import React, { useState, useEffect } from 'react';
import ListManager from './ListManager';
import ListViewer from './ListViewer';
import AddressManager from './AddressManager';
import { whitelists, sync } from '../services/api';

function Dashboard({ onLogout }) {
  const [activeTab, setActiveTab] = useState('viewer');
  const [allLists, setAllLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const username = localStorage.getItem('username');

  useEffect(() => {
    fetchWhitelists();
  }, [refreshKey]);

  const fetchWhitelists = async () => {
    setLoading(true);
    try {
      const data = await whitelists.getAll();
      setAllLists(data);
    } catch (error) {
      console.error('Error fetching whitelists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncMongoDB = async () => {
    setLoading(true);
    try {
      const result = await sync.syncMongoDB();

      if (result.success) {
        const fcfsAdded = result.details.fcfs.addedCount;
        const gtdAdded = result.details.gtd.addedCount;
        const totalAdded = fcfsAdded + gtdAdded;

        if (totalAdded > 0) {
          alert(`Sync successful!\n\nAdded ${fcfsAdded} FCFS addresses\nAdded ${gtdAdded} GTD addresses`);
        } else {
          alert('Sync completed. No new addresses to add.');
        }

        handleRefresh();
      } else {
        alert(`Sync failed:\n${result.details.fcfs.message}\n${result.details.gtd.message}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert('Failed to sync with database');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    setSelectedList(null);
  };

  const handleSelectList = (list) => {
    setSelectedList(list);
    setActiveTab('addresses');
  };

  const getStats = () => {
    const freeCount = allLists.filter(l => l.category === 'free').length;
    const gtdCount = allLists.filter(l => l.category === 'gtd').length;
    const fcfsCount = allLists.filter(l => l.category === 'fcfs').length;
    const publicCount = allLists.filter(l => l.category === 'public').length;

    const freeAddresses = allLists.filter(l => l.category === 'free').reduce((sum, l) => sum + l.addresses.length, 0);
    const gtdAddresses = allLists.filter(l => l.category === 'gtd').reduce((sum, l) => sum + l.addresses.length, 0);
    const fcfsAddresses = allLists.filter(l => l.category === 'fcfs').reduce((sum, l) => sum + l.addresses.length, 0);
    const publicAddresses = allLists.filter(l => l.category === 'public').reduce((sum, l) => sum + l.addresses.length, 0);

    const totalAddresses = freeAddresses + gtdAddresses + fcfsAddresses + publicAddresses;
    return {
      freeCount, gtdCount, fcfsCount, publicCount,
      freeAddresses, gtdAddresses, fcfsAddresses, publicAddresses,
      totalAddresses, totalLists: allLists.length
    };
  };

  const stats = getStats();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Whitelist Manager</h1>
          <div className="header-actions">
            <span className="username">Welcome, {username}</span>
            <button onClick={handleSyncMongoDB} className="btn btn-primary">
              Sync with DB
            </button>
            <button onClick={handleRefresh} className="btn btn-secondary">
              Refresh
            </button>
            <button onClick={onLogout} className="btn btn-danger">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.totalLists}</div>
          <div className="stat-label">
            Total Lists
            <div className="stat-detail">
              Free: {stats.freeCount} | GTD: {stats.gtdCount} | FCFS: {stats.fcfsCount} | Public: {stats.publicCount}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalAddresses}</div>
          <div className="stat-label">Total Addresses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.freeAddresses}</div>
          <div className="stat-label">Free Addresses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.gtdAddresses}</div>
          <div className="stat-label">GTD Addresses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.fcfsAddresses}</div>
          <div className="stat-label">FCFS Addresses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.publicAddresses}</div>
          <div className="stat-label">Public Addresses</div>
        </div>
      </div>

      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === 'viewer' ? 'active' : ''}`}
          onClick={() => setActiveTab('viewer')}
        >
          Overview ({stats.totalAddresses})
        </button>
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create List
        </button>
        <button
          className={`tab ${activeTab === 'addresses' ? 'active' : ''}`}
          onClick={() => setActiveTab('addresses')}
          disabled={!selectedList}
        >
          Manage {selectedList && `(${selectedList.name})`}
        </button>
      </div>

      <div className="dashboard-content">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        )}

        {activeTab === 'viewer' && (
          <ListViewer
            lists={allLists}
            onRefresh={handleRefresh}
            onSelectList={handleSelectList}
          />
        )}

        {activeTab === 'create' && (
          <ListManager onListCreated={handleRefresh} />
        )}

        {activeTab === 'addresses' && selectedList && (
          <AddressManager
            list={selectedList}
            onUpdate={handleRefresh}
            onBack={() => setActiveTab('viewer')}
          />
        )}
      </div>
    </div>
  );
}

export default Dashboard;