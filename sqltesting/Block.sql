SELECT * FROM file;

SELECT * FROM block;


INSERT INTO block (blockhash) values ('A');

SELECT * FROM block WHERE blockhash in ('A', 'C');


SELECT blockhash FROM block 
WHERE blockhash IN ('smiley.png');


SELECT EXISTS(SELECT 1 FROM block WHERE blockhash IN ('B', 'D', 'F'));


DELETE FROM block WHERE createtime > '2024-05-14 23:27:49.163';