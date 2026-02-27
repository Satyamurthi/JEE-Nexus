
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login
    localStorage.setItem('user_profile', JSON.stringify({
      email,
      role: email.includes('admin') ? 'admin' : 'user',
      status: 'approved'
    }));
    navigate('/');
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="p-8 bg-white rounded-3xl shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-black mb-6">Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input 
            type="email" 
            placeholder="Email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-4 border rounded-xl"
            required
          />
          <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
