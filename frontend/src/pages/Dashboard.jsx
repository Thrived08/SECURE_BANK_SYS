import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, clearToken } from '../api.js';

export default function Dashboard() {
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const { accounts } = await api.myAccounts();
      const acc = accounts[0];
      setAccount(acc);
      if (acc) {
        const { transactions } = await api.history(acc.id);
        setTransactions(transactions);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeposit() {
    const amount = prompt('Amount to deposit (test funds):');
    if (!amount) return;
    try {
      await api.deposit({ accountId: account.id, amount: parseFloat(amount) });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    clearToken();
    navigate('/login');
  }

  if (error) return <div className="page error">{error}</div>;
  if (!account) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <nav className="navbar">
        <span className="brand">SecureBank</span>
        <div>
          <Link to="/transfer">Transfer</Link>
          <button className="link-btn" onClick={logout}>
            Log out
          </button>
        </div>
      </nav>

      <div className="balance-card">
        <p className="label">Account {account.accountNumber}</p>
        <h2>${account.balance.toFixed(2)}</h2>
        <button onClick={handleDeposit}>Add test funds</button>
      </div>

      <h3>Recent transactions</h3>
      <ul className="tx-list">
        {transactions.length === 0 && <li className="empty">No transactions yet</li>}
        {transactions.map((tx) => (
          <li key={tx.id}>
            <span>{tx.description || tx.type}</span>
            <span className={tx.direction === 'in' ? 'amount in' : 'amount out'}>
              {tx.direction === 'in' ? '+' : '-'}${tx.amount.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
