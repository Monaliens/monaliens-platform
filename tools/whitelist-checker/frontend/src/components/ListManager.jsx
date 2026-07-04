import React, { useState, useEffect } from 'react';
import { whitelists } from '../services/api';

function ListManager({ onListCreated }) {
  const [allLists, setAllLists] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    category: 'gtd',
    addresses: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAllLists();
  }, []);

  const fetchAllLists = async () => {
    try {
      const data = await whitelists.getAll();
      setAllLists(data);
    } catch (error) {
      console.error('Error fetching lists:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name) {
      setError('Please enter a list name');
      return;
    }

    // Parse addresses
    const addressArray = formData.addresses
      .split(/[\n,]+/)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0 && addr.startsWith('0x'));

    if (addressArray.length === 0) {
      setError('Please enter valid Ethereum addresses');
      return;
    }

    // Create list directly
    await createList(addressArray);
  };

  const createList = async (addressArray) => {
    setLoading(true);
    try {
      const data = {
        name: formData.name,
        category: formData.category,
        addresses: addressArray
      };

      const result = await whitelists.create(data);
      setSuccess(`List "${formData.name}" created successfully with ${addressArray.length} addresses`);

      // Reset form
      setFormData({
        name: '',
        category: 'gtd',
        addresses: ''
      });

      // Refresh lists
      fetchAllLists();

      if (onListCreated) {
        onListCreated();
      }
    } catch (error) {
      setError(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Failed to create list'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="list-manager">
      <h2>Create New Whitelist</h2>

      <form onSubmit={handleSubmit} className="create-form">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">List Name*</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., pokernightwinners"
                  pattern="[a-zA-Z0-9_-]{3,50}"
                  title="3-50 characters, alphanumeric, underscores, and hyphens only"
                  required
                  disabled={loading}
                />
                <small>Use only letters, numbers, underscores, and hyphens (3-50 chars)</small>
              </div>

              <div className="form-group">
                <label htmlFor="category">Category*</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  required
                  disabled={loading}
                >
                  <option value="free">Free</option>
                  <option value="gtd">GTD (Guaranteed)</option>
                  <option value="fcfs">FCFS (First Come First Serve)</option>
                  <option value="public">Public</option>
                </select>
                <small>Choose the whitelist type</small>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="addresses">Addresses*</label>
              <textarea
                id="addresses"
                name="addresses"
                value={formData.addresses}
                onChange={handleChange}
                placeholder="Enter Ethereum addresses, one per line or comma-separated&#10;&#10;Example:&#10;0x742d35Cc6634C0532925a3b844Bc9e7595f0fA65&#10;0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed"
                rows="10"
                disabled={loading}
                required
              />
              <small>Enter valid Ethereum addresses (0x followed by 40 hex characters)</small>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create List'}
              </button>
              <button
                type="reset"
                className="btn btn-secondary"
                onClick={() => {
                  setFormData({ name: '', category: 'gtd', addresses: '' });
                  setError('');
                  setSuccess('');
                }}
                disabled={loading}
              >
                Clear
              </button>
            </div>
          </>
      </form>

      <div className="info-box">
        <h3>Quick Tips:</h3>
        <ul>
          <li><strong>Free:</strong> Free tier whitelist</li>
          <li><strong>GTD (Guaranteed):</strong> Fixed allocation whitelist</li>
          <li><strong>FCFS (First Come First Serve):</strong> Time-based priority whitelist</li>
          <li><strong>Public:</strong> Publicly accessible whitelist</li>
          <li>You can add addresses later using the Address Manager</li>
          <li>Each list name must be unique within its category</li>
        </ul>
      </div>
    </div>
  );
}

export default ListManager;