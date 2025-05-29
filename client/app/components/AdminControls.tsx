import React, { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Button } from "~/components/ui/button";
import { Input } from "../components/ui/input";

interface AdminControlsProps {
  isRegistrationOpen: boolean;
}

const AdminControls: React.FC<AdminControlsProps> = ({ isRegistrationOpen }) => {
  const [testUsername, setTestUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOpenRegistration = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/registration/open', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to open registration');
      }

      console.log('Registration opened successfully');
    } catch (error) {
      console.error('Error opening registration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRegistration = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/registration/close', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to close registration');
      }

      console.log('Registration closed successfully');
    } catch (error) {
      console.error('Error closing registration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetRats = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/participants/reset', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to reset participants');
      }

      console.log('Participants reset successfully');
    } catch (error) {
      console.error('Error resetting participants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestRegistration = async () => {
    if (!testUsername.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/test/chat-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: testUsername,
          message: '!register'
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to simulate chat message');
      }

      console.log('Test registration sent successfully');
      setTestUsername(''); // Clear input
    } catch (error) {
      console.error('Error sending test registration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async () => {
    if (!testUsername.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/test/add-participant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: testUsername,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to add participant');
      }

      console.log('Participant added successfully');
      setTestUsername(''); // Clear input
    } catch (error) {
      console.error('Error adding participant:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-slate-800 rounded-lg border border-slate-700 shadow-lg">
      <h2 className="text-xl font-bold text-slate-200 mb-4">Admin Controls</h2>

      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Button
            onClick={handleOpenRegistration}
            disabled={loading || isRegistrationOpen}
            className="bg-green-600 hover:bg-green-700 flex-1"
          >
            Open Registration
          </Button>
          <Button
            onClick={handleCloseRegistration}
            disabled={loading || !isRegistrationOpen}
            className="bg-red-600 hover:bg-red-700 flex-1"
          >
            Close Registration
          </Button>
        </div>

        <div className="pt-2 border-t border-slate-700">
          <Button
            onClick={handleResetRats}
            disabled={loading}
            className="w-full bg-yellow-600 hover:bg-yellow-700"
          >
            Reset Rats
          </Button>
        </div>

        <div className="pt-2 border-t border-slate-700">
          <h3 className="text-md font-semibold text-slate-300 mb-2">Test Chat Registration</h3>
          <div className="flex gap-2">
            <Input
              value={testUsername}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTestUsername(e.target.value)}
              placeholder="Username"
              className="flex-1 bg-slate-700 border-slate-600 text-slate-200"
            />
            <Button
              onClick={handleTestRegistration}
              disabled={loading || !testUsername.trim() || !isRegistrationOpen}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Test !register
            </Button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-700">
          <h3 className="text-md font-semibold text-slate-300 mb-2">Add Participant Directly</h3>
          <div className="flex gap-2">
            <Input
              value={testUsername}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setTestUsername(e.target.value)}
              placeholder="Username"
              className="flex-1 bg-slate-700 border-slate-600 text-slate-200"
            />
            <Button
              onClick={handleAddParticipant}
              disabled={loading || !testUsername.trim() || !isRegistrationOpen}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Add Directly
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${isRegistrationOpen ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
          Registration: {isRegistrationOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>
    </div>
  );
};

export default AdminControls;