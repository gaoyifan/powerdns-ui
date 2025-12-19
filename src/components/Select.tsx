import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    block?: boolean;
    options?: { value: string; label: string; disabled?: boolean }[];
    children?: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
    label,
    block = false,
    options,
    children,
    className = '',
    id,
    ...props
}) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
        <div className={`${block ? 'w-full' : ''}`}>
            {label && (
                <label
                    htmlFor={selectId}
                    className="block text-sm font-medium text-text-secondary mb-1"
                >
                    {label}
                </label>
            )}
            <select
                id={selectId}
                className={`
          block rounded-md border border-border bg-bg-card
          px-3 py-2 pr-8 text-sm text-text-primary
          focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
          disabled:bg-disabled/20 disabled:text-text-muted disabled:cursor-not-allowed
          transition-all duration-[var(--transition-fast)]
          appearance-none
          bg-no-repeat bg-right
          ${block ? 'w-full' : ''}
          ${className}
        `}
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundSize: '1.5em 1.5em',
                }}
                {...props}
            >
                {options ? options.map(opt => (
                    <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                        {opt.label}
                    </option>
                )) : children}
            </select>
        </div>
    );
};
