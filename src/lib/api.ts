// Deprecated: no backend calls required. Keeping a minimal stub to avoid import errors.
export const apiClient = () => {
  const json = async <T>(_path: string, _init?: RequestInit) => {
    throw new Error('apiClient is disabled: backend not required.');
  };
  return { json };
};