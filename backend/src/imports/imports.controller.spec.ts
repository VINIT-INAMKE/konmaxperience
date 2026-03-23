describe('ImportsController', () => {
  it.todo('POST /imports/parse — accepts CSV file upload and returns ParseResult');
  it.todo('POST /imports/parse — accepts XLSX file upload and returns ParseResult');
  it.todo('POST /imports/parse — rejects unsupported file types');
  it.todo('POST /imports/parse — rejects missing file');
  it.todo('POST /imports/parse — rejects invalid importType');
  it.todo('POST /imports/commit — accepts CommitImportDto and returns CommitResult');
  it.todo('GET /imports/template/:type — returns XLSX template for ingredients');
  it.todo('GET /imports/template/:type — returns XLSX template for vendors');
  it.todo('GET /imports/template/:type — returns XLSX template for vendor_pricing');
  it.todo('GET /imports/template/:type/csv — returns CSV template');
  it.todo('GET /imports/template/:type — rejects invalid import type');
  it.todo('all endpoints require MANAGE_SYSTEM permission');
});
