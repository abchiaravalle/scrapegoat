<?php
/**
 * Send email notification when scraping job is complete
 * Usage: php sendEmail.php <jobId> <email> <shareLink>
 */

if ($argc < 4) {
    echo "Usage: php sendEmail.php <jobId> <email> <shareLink>\n";
    exit(1);
}

$jobId = $argv[1];
$email = $argv[2];
$shareLink = $argv[3];

// Validate email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo "Invalid email address: $email\n";
    exit(1);
}

// Email subject
$subject = "Your scraping job is complete - Job ID: $jobId";

// Email body
$message = "Your web scraping job has been completed!\n\n";
$message .= "Job ID: $jobId\n";
$message .= "You can view and download your documents at:\n";
$message .= "$shareLink\n\n";
$message .= "Thank you for using ScrapeGoat!";

// Email headers
$headers = "From: noreply@scrapegoat.com\r\n";
$headers .= "Reply-To: noreply@scrapegoat.com\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

// Send email
$success = mail($email, $subject, $message, $headers);

if ($success) {
    echo "Email sent successfully to $email\n";
    exit(0);
} else {
    echo "Failed to send email to $email\n";
    exit(1);
}
?>

