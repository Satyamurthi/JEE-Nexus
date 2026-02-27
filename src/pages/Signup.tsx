
import React from 'react';
import { useNavigate } from 'react-router-dom';

const Signup = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="p-8 bg-white rounded-3xl shadow-xl w-full max-w-md text-center">
        <h1 className="text-3xl font-black mb-6">Sign Up</h1>
        <p className="mb-8">Registration is currently restricted to invited users.</p>
        <button onClick={() => navigate('/login')} className="text-blue-600 font-bold">
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default Signup;
