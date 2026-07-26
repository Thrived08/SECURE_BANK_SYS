import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function Transfer() {
  const [account, setAccount] = useState(null);
  const [toAccountNumber, setToAccountNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.myAccounts().then(({ accounts }) => setAccount(accounts[0]));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.transfer({
        fromAccountId: account.id,
        toAccountNumber,
        amount: parseFloat(amount),
      });
      setSuccess('Transfer complete');
      setToAccountNumber('');
      setAmount('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <nav className="navbar">
        <span className="brand">SecureBank</span>
        <Link to="/dashboard">Back to dashboard</Link>
      </nav>

      <form onSubmit={handleSubmit} className="card">
        <h2>Send money</h2>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        <label>Recipient account number</label>
        <input
          value={toAccountNumber}
          onChange={(e) => setToAccountNumber(e.target.value)}
          maxLength={10}
          required
        />
        <label>Amount (USD)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
