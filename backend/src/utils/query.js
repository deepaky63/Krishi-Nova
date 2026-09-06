export const pagination = (query) => {
  const page = Math.max(Number(query.page || 1), 1);
  const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

export const paged = (items, total, page, limit) => ({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
