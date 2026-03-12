import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm transition-colors focus:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 ${
            error ? "border-red-300" : "border-gray-200"
          } ${className}`}
          {...props}
        />
        {hint && !error && (
          <p className="text-xs text-gray-400 mt-1">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
