type StatusMessageProps = {
  message: string;
  isError: boolean;
};

export function StatusMessage({ message, isError }: StatusMessageProps) {
  if (!message) return null;

  return <p className={isError ? 'status-message error' : 'status-message'} role={isError ? 'alert' : 'status'}>
    {message}
  </p>;
}
