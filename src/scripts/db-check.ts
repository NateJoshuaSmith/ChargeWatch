async function main(): Promise<void> {
  const { DatabaseConnectionError, checkDatabaseConnection } =
    await import("../services/database.js");

  try {
    await checkDatabaseConnection();
    console.log("Database connection succeeded.");
  } catch (error: unknown) {
    if (error instanceof DatabaseConnectionError) {
      console.error(error.message);
      console.error(error.reason);
      process.exit(1);
    }

    const message =
      error instanceof Error ? error.message : "Database connection failed.";
    console.error(message);
    process.exit(1);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Database connection failed.";
    console.error(message);
    process.exit(1);
  });
