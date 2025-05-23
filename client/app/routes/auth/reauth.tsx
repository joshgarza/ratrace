import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ReAuth() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleReAuth = async () => {
      try {
        console.log('Initiating re-authentication...');
        // Call the server's reauth endpoint
        const response = await fetch("http://localhost:3000/auth/reauth", {
          credentials: "include", // Important for session cookies
          redirect: 'manual', // Don't automatically follow redirects
        });

        if (response.type === 'opaqueredirect') {
          // The server is trying to redirect us to Twitch
          console.log('Received redirect to Twitch auth page');
          // Get the redirect URL from the response headers
          const redirectUrl = response.headers.get('location');
          if (redirectUrl) {
            console.log('Redirecting to:', redirectUrl);
            window.location.href = redirectUrl;
          } else {
            throw new Error('No redirect URL received');
          }
        } else if (!response.ok) {
          throw new Error(`Re-auth failed: ${response.status}`);
        }
      } catch (error) {
        console.error("Re-authentication error:", error);
        // Redirect to home with error state
        navigate("/?error=auth_failed");
      }
    };

    handleReAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-purple-400 mb-4">Re-authenticating...</h1>
        <p className="text-slate-400">Please wait while we redirect you to Twitch.</p>
      </div>
    </div>
  );
}