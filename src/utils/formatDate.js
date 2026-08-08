import { format } from 'date-fns';

export const formatDate = (date) => {
  if (!date) return null;
  return format(new Date(date), 'dd-MM-yyyy HH:mm:ss');
};
