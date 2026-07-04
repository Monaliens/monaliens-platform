import React, { useState, useEffect } from 'react';
import { whitelists } from '../services/api';

function AddressManager({ list, onUpdate, onBack }) {
  const [allLists, setAllLists] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [newAddresses, setNewAddresses] = useState('');
  const [selectedAddresses, setSelectedAddresses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  useEffect(() => {
    if (list) {
      setAddresses(list.addresses || []);
    }
    fetchAllLists();
  }, [list]);

  const fetchAllLists = async () => {
    try {
      const data = await whitelists.getAll();
      setAllLists(data);
    } catch (error) {
      console.error('Error fetching lists:', error);
    }
  };

  const checkForDuplicates = (addressArray) => {
    const duplicates = [];

    addressArray.forEach(address => {
      // Only check in current list (cross-list duplicates are allowed)
      if (addresses.includes(address)) {
        duplicates.push({
          address,
          type: 'current',
          lists: [{ name: list.name, category: list.category }]
        });
      }
    });

    return duplicates;
  };

  const filteredAddresses = addresses.filter(addr =>
    addr.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddAddresses = async () => {
    setError('');
    setSuccess('');
    setDuplicateWarning(null);
    setLoading(true);

    try {
      const addressArray = newAddresses
        .split(/[\n,]+/)
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0 && addr.startsWith('0x'));

      if (addressArray.length === 0) {
        setError('Please enter at least one address');
        setLoading(false);
        return;
      }

      // Check for duplicates
      const duplicates = checkForDuplicates(addressArray);
      if (duplicates.length > 0 && !duplicateWarning) {
        setDuplicateWarning({
          duplicates,
          addresses: addressArray,
          action: 'add'
        });
        setLoading(false);
        return;
      }

      const result = await whitelists.addAddresses(list.category, list.name, addressArray);
      setSuccess(`Added ${addressArray.length} addresses successfully`);
      setNewAddresses('');
      setDuplicateWarning(null);

      // Refresh the list
      const updated = await whitelists.get(list.category, list.name);
      setAddresses(updated.addresses);
      fetchAllLists();

      if (onUpdate) onUpdate();
    } catch (error) {
      setError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to add addresses'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateAction = async (action) => {
    if (action === 'skip-duplicates') {
      // Add only unique addresses
      const duplicateAddresses = duplicateWarning.duplicates.map(d => d.address);
      const uniqueAddresses = duplicateWarning.addresses.filter(addr => !duplicateAddresses.includes(addr));

      if (uniqueAddresses.length === 0) {
        setError('No unique addresses to add');
        setDuplicateWarning(null);
        return;
      }

      try {
        const result = await whitelists.addAddresses(list.category, list.name, uniqueAddresses);
        setSuccess(`Added ${uniqueAddresses.length} unique addresses (skipped ${duplicateAddresses.length} duplicates)`);
        setNewAddresses('');
        setDuplicateWarning(null);

        const updated = await whitelists.get(list.category, list.name);
        setAddresses(updated.addresses);
        fetchAllLists();
        if (onUpdate) onUpdate();
      } catch (error) {
        setError(error.response?.data?.error || 'Failed to add addresses');
      }
    } else {
      // Cancel
      setDuplicateWarning(null);
    }
  };

  const handleRemoveSelected = async () => {
    if (selectedAddresses.length === 0) {
      setError('Please select addresses to remove');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await whitelists.removeAddresses(list.category, list.name, selectedAddresses);
      setSuccess(`Removed ${selectedAddresses.length} addresses successfully`);
      setSelectedAddresses([]);

      // Refresh the list
      const updated = await whitelists.get(list.category, list.name);
      setAddresses(updated.addresses);

      if (onUpdate) onUpdate();
    } catch (error) {
      setError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to remove addresses'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReplaceAll = async () => {
    if (!window.confirm('This will replace ALL addresses in this list. Are you sure?')) {
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const addressArray = newAddresses
        .split(/[\n,]+/)
        .map(addr => addr.trim())
        .filter(addr => addr.length > 0 && addr.startsWith('0x'));

      const result = await whitelists.replaceAddresses(list.category, list.name, addressArray);
      setSuccess(`Replaced all addresses successfully (${addressArray.length} addresses)`);
      setNewAddresses('');

      // Refresh the list
      const updated = await whitelists.get(list.category, list.name);
      setAddresses(updated.addresses);

      if (onUpdate) onUpdate();
    } catch (error) {
      setError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to replace addresses'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleAddressSelection = (address) => {
    if (selectedAddresses.includes(address)) {
      setSelectedAddresses(selectedAddresses.filter(a => a !== address));
    } else {
      setSelectedAddresses([...selectedAddresses, address]);
    }
  };

  const selectAll = () => {
    setSelectedAddresses(filteredAddresses);
  };

  const deselectAll = () => {
    setSelectedAddresses([]);
  };

  const copyAddresses = () => {
    const text = addresses.join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setSuccess(`Copied ${addresses.length} addresses to clipboard!`);
    }).catch(() => {
      setError('Failed to copy addresses to clipboard');
    });
  };

  return (
    <div className="address-manager">
      <div className="manager-header">
        <div className="header-info">
          <button onClick={onBack} className="btn btn-secondary">← Back</button>
          <h2>{list.name}</h2>
          <span className={`category-badge ${list.category}`}>
            {list.category.toUpperCase()}
          </span>
        </div>

        <div className="header-stats">
          <span>Total Addresses: {addresses.length}</span>
          {selectedAddresses.length > 0 && (
            <span>Selected: {selectedAddresses.length}</span>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {duplicateWarning && (
        <div className="duplicate-warning">
          <h3>⚠️ Duplicate Addresses Detected</h3>
          <div className="duplicate-list">
            <div className="duplicate-section">
              <h4>Already in this list:</h4>
              {duplicateWarning.duplicates.map((dup, idx) => (
                <div key={idx} className="duplicate-item">
                  <span className="duplicate-address">{dup.address}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="duplicate-actions">
            <button
              type="button"
              onClick={() => handleDuplicateAction('skip-duplicates')}
              className="btn btn-primary"
            >
              Add Only Unique
            </button>
            <button
              type="button"
              onClick={() => handleDuplicateAction('cancel')}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="manager-body">
        <div className="address-input-section">
          <div className="section-header">
            <h3>Add/Replace Addresses</h3>
            <button
              onClick={() => setBulkMode(!bulkMode)}
              className="btn btn-secondary btn-sm"
            >
              {bulkMode ? 'Single Mode' : 'Bulk Mode'}
            </button>
          </div>

          <textarea
            value={newAddresses}
            onChange={(e) => setNewAddresses(e.target.value)}
            placeholder="Enter Ethereum addresses, one per line or comma-separated"
            rows={bulkMode ? 10 : 3}
            disabled={loading}
          />

          <div className="action-buttons">
            <button
              onClick={handleAddAddresses}
              className="btn btn-primary"
              disabled={loading || !newAddresses.trim()}
            >
              Add Addresses
            </button>
            <button
              onClick={handleReplaceAll}
              className="btn btn-warning"
              disabled={loading || !newAddresses.trim()}
            >
              Replace All
            </button>
          </div>
        </div>

        <div className="address-list-section">
          <div className="section-header">
            <h3>Current Addresses ({addresses.length})</h3>
            <div className="section-actions">
              <input
                type="text"
                placeholder="Search addresses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button onClick={copyAddresses} className="btn btn-secondary btn-sm">
                Copy All
              </button>
            </div>
          </div>

          {addresses.length === 0 ? (
            <div className="empty-state">
              <p>No addresses in this list yet</p>
              <p>Add some addresses using the form above</p>
            </div>
          ) : (
            <>
              <div className="selection-controls">
                <button onClick={selectAll} className="btn btn-link">
                  Select All ({filteredAddresses.length})
                </button>
                <button onClick={deselectAll} className="btn btn-link">
                  Deselect All
                </button>
                {selectedAddresses.length > 0 && (
                  <button
                    onClick={handleRemoveSelected}
                    className="btn btn-danger btn-sm"
                    disabled={loading}
                  >
                    Remove Selected ({selectedAddresses.length})
                  </button>
                )}
              </div>

              <div className="address-grid">
                {filteredAddresses.map((address, index) => (
                  <div
                    key={index}
                    className={`address-item ${
                      selectedAddresses.includes(address) ? 'selected' : ''
                    }`}
                    onClick={() => toggleAddressSelection(address)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedAddresses.includes(address)}
                      onChange={() => {}}
                    />
                    <span className="address-text">{address}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(address);
                      }}
                      className="btn-copy"
                      title="Copy address"
                    >
                      📋
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddressManager;