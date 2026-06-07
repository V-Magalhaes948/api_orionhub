import { format } from 'date-fns';

export const formatDate = (date) =>
  format(new Date(date), 'dd-MM-yyyy HH:mm:dd');
