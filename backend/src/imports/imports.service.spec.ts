describe('ImportsService', () => {
  it.todo('parseFile — parses CSV buffer and returns ParseResult with validated rows');
  it.todo('parseFile — parses XLSX buffer and returns ParseResult with validated rows');
  it.todo('parseFile — throws BadRequestException when file contains no data rows');
  it.todo('parseFile — normalizes column headers to lowercase');
  it.todo('parseFile — detects duplicate ingredients by case-insensitive name match');
  it.todo('parseFile — detects duplicate vendors by case-insensitive name match');
  it.todo('parseFile — validates vendor_pricing foreign key references (vendor name, ingredient name)');
  it.todo('parseFile — marks rows with missing required fields as invalid');
  it.todo('parseFile — marks rows with invalid number fields as invalid');
  it.todo('commitImport — creates new records for valid rows');
  it.todo('commitImport — updates existing records when updateExisting is true');
  it.todo('commitImport — skips duplicate rows when updateExisting is false');
  it.todo('commitImport — uses transaction for atomicity');
  it.todo('commitImport — returns CommitResult with imported, updated, skipped, errors counts');
});
