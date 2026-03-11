-- Migration to add intro_content and izzy_intro_image to level_configurations

ALTER TABLE level_configurations
ADD COLUMN intro_content TEXT,
ADD COLUMN izzy_intro_image TEXT;
