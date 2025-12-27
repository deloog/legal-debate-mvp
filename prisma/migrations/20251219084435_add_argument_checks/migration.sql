-- Add CHECK constraints for Argument content validation
ALTER TABLE "arguments" 
ADD CONSTRAINT "check_content_not_empty" 
CHECK (length(trim(content)) >= 3);

-- Add CHECK constraint for maximum content length
ALTER TABLE "arguments" 
ADD CONSTRAINT "check_content_max_length" 
CHECK (length(content) <= 10000);
