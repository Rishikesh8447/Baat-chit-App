import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, MessageSquare } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const { forgotPassword, isRequestingPasswordReset } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    const data = await forgotPassword(email.trim());
    if (data?.resetLink) setGeneratedLink(data.resetLink);
  };

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md bg-base-100 border border-base-300 rounded-xl p-6 sm:p-8">
        <div className="text-center mb-6">
          <div className="mx-auto mb-3 w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Forgot Password</h1>
          <p className="text-base-content/70 mt-1">Enter your email to generate a reset link</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-base-content">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-base-content/40" />
              </div>
              <input
                type="email"
                className="input input-bordered w-full pl-10"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={isRequestingPasswordReset}>
            {isRequestingPasswordReset ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Reset Link"
            )}
          </button>
        </form>

        {generatedLink && (
          <div className="mt-4 rounded-lg border border-base-300 bg-base-200 p-3">
            <p className="text-sm mb-1">Reset link (dev):</p>
            <a className="text-primary break-all text-sm" href={generatedLink}>
              {generatedLink}
            </a>
          </div>
        )}

        <p className="text-center mt-4 text-sm text-base-content/70">
          Remembered your password?{" "}
          <Link to="/login" className="text-primary hover:opacity-80">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
