import React, { useState } from 'react';
import { whitelists } from '../services/api';

function ListViewer({ lists, onRefresh, onSelectList }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'cards'
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Flatten all addresses with their list info
  const getAllAddresses = () => {
    const allAddresses = [];
    lists.forEach(list => {
      list.addresses.forEach(address => {
        allAddresses.push({
          address,
          listName: list.name,
          category: list.category
        });
      });
    });
    return allAddresses;
  };

  const allAddresses = getAllAddresses();

  // Filter addresses based on search and category filter
  const filteredAddresses = allAddresses.filter(item => {
    const categoryMatch = filter === 'all' || item.category === filter;
    const searchMatch = item.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.listName.toLowerCase().includes(searchTerm.toLowerCase());
    return categoryMatch && searchMatch;
  });

  const filteredLists = lists.filter(list => {
    const categoryMatch = filter === 'all' || list.category === filter;
    const searchMatch = list.name.toLowerCase().includes(searchTerm.toLowerCase());
    return categoryMatch && searchMatch;
  });

  const handleDelete = async (list) => {
    try {
      await whitelists.delete(list.category, list.name);
      setDeleteConfirm(null);
      onRefresh();
    } catch (error) {
      alert(`Failed to delete list: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleExport = async (list, format) => {
    try {
      await whitelists.export(list.category, list.name, format);
    } catch (error) {
      alert(`Failed to export list: ${error.response?.data?.error || error.message}`);
    }
  };

  const copyAddress = (address) => {
    navigator.clipboard.writeText(address).then(() => {
      // Silent copy, no alert
    }).catch(() => {
      alert('Failed to copy address to clipboard');
    });
  };

  const copyAllFilteredAddresses = () => {
    const addresses = filteredAddresses.map(item => item.address).join('\n');
    navigator.clipboard.writeText(addresses).then(() => {
      alert(`Copied ${filteredAddresses.length} addresses to clipboard!`);
    }).catch(() => {
      alert('Failed to copy addresses to clipboard');
    });
  };

  return (
    <div className="list-viewer">
      <div className="viewer-header">
        <h2>Whitelist Overview</h2>

        <div className="viewer-controls">
          <input
            type="text"
            placeholder="Search addresses or lists..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <div className="filter-buttons">
            <button
              className={`btn btn-filter ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              Table View
            </button>
            <button
              className={`btn btn-filter ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
            >
              Cards View
            </button>
            <span className="divider">|</span>
            <button
              className={`btn btn-filter ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({allAddresses.length})
            </button>
            <button
              className={`btn btn-filter ${filter === 'free' ? 'active' : ''}`}
              onClick={() => setFilter('free')}
            >
              Free ({allAddresses.filter(a => a.category === 'free').length})
            </button>
            <button
              className={`btn btn-filter ${filter === 'gtd' ? 'active' : ''}`}
              onClick={() => setFilter('gtd')}
            >
              GTD ({allAddresses.filter(a => a.category === 'gtd').length})
            </button>
            <button
              className={`btn btn-filter ${filter === 'fcfs' ? 'active' : ''}`}
              onClick={() => setFilter('fcfs')}
            >
              FCFS ({allAddresses.filter(a => a.category === 'fcfs').length})
            </button>
            <button
              className={`btn btn-filter ${filter === 'public' ? 'active' : ''}`}
              onClick={() => setFilter('public')}
            >
              Public ({allAddresses.filter(a => a.category === 'public').length})
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'table' ? (
        // Table View - All Addresses
        <div className="addresses-table-container">
          <div className="table-header">
            <h3>All Addresses ({filteredAddresses.length})</h3>
            {filteredAddresses.length > 0 && (
              <button onClick={copyAllFilteredAddresses} className="btn btn-secondary btn-sm">
                Copy All Filtered
              </button>
            )}
          </div>

          {filteredAddresses.length === 0 ? (
            <div className="empty-state">
              <p>No addresses found</p>
              {searchTerm && <p>Try adjusting your search term</p>}
            </div>
          ) : (
            <table className="addresses-table">
              <thead>
                <tr>
                  <th>Address</th>
                  <th>List Name</th>
                  <th>Category</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAddresses.map((item, index) => (
                  <tr key={index}>
                    <td className="address-cell">
                      <span className="mono-text">{item.address}</span>
                    </td>
                    <td>{item.listName}</td>
                    <td>
                      <span className={`category-badge ${item.category}`}>
                        {item.category.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => copyAddress(item.address)}
                        className="btn btn-sm"
                        title="Copy address"
                      >
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        // Cards View - Lists
        <div className="lists-grid">
          {filteredLists.length === 0 ? (
            <div className="empty-state">
              <p>No whitelists found</p>
              {searchTerm && <p>Try adjusting your search term</p>}
            </div>
          ) : (
            filteredLists.map(list => (
              <div key={`${list.category}-${list.name}`} className="list-card">
                <div className="list-card-header">
                  <h3>{list.name}</h3>
                  <span className={`category-badge ${list.category}`}>
                    {list.category.toUpperCase()}
                  </span>
                </div>

                <div className="list-card-body">
                  <div className="list-info">
                    <div className="info-item">
                      <strong>Addresses:</strong> {list.addresses.length}
                    </div>
                    <div className="info-item">
                      <strong>Created:</strong> {new Date(list.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div className="list-card-actions">
                  <button
                    onClick={() => onSelectList(list)}
                    className="btn btn-primary btn-sm"
                  >
                    Manage
                  </button>

                  <div className="dropdown">
                    <button className="btn btn-secondary btn-sm">Export</button>
                    <div className="dropdown-content">
                      <button onClick={() => handleExport(list, 'json')}>JSON</button>
                      <button onClick={() => handleExport(list, 'txt')}>TXT</button>
                      <button onClick={() => handleExport(list, 'csv')}>CSV</button>
                    </div>
                  </div>

                  {deleteConfirm === `${list.category}-${list.name}` ? (
                    <div className="delete-confirm">
                      <button
                        onClick={() => handleDelete(list)}
                        className="btn btn-danger btn-sm"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="btn btn-secondary btn-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(`${list.category}-${list.name}`)}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ListViewer;