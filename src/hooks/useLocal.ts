export const useLocal = (key: string) => {
  const get = () => localStorage.getItem(key);
  const set = (value: string) => localStorage.setItem(key, value);
  const remove = () => localStorage.removeItem(key);
  return { get, set, remove };  
}