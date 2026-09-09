import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import './LoginPage.css';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const expectedUsername = import.meta.env.VITE_APP_USERNAME || 'admin';
  const expectedPassword = import.meta.env.VITE_APP_PASSWORD || 'Success@12345';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (username === expectedUsername && password === expectedPassword) {
      onLogin();
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-header">
          <div className="login-icon">
            <Lock size={28} />
          </div>
          <h1 className="login-title">VFX Tracker Access</h1>
          <p className="login-subtitle">Please sign in to continue</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}
          
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <button type="submit" className="login-btn">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
