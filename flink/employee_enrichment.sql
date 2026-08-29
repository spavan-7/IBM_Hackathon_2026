-- INTENTIONALLY BROKEN FOR HACKATHON INVESTIGATION
-- Source table EMPLOYEE_EVENTS is assumed to contain employee events.

CREATE TEMPORARY VIEW ST_OUTPUT AS
SELECT
    personId,
    assignmentClass,
    serviceDate,
    event
FROM EMPLOYEE_EVENTS
WHERE assignmentClass = 'ST';

CREATE TEMPORARY VIEW GA_OUTPUT AS
SELECT
    personId,
    assignmentClass,
    serviceDate,
    event
FROM EMPLOYEE_EVENTS
WHERE assignmentClass = 'GA';

CREATE TEMPORARY VIEW ENRICHMENT_VIEW AS
SELECT
    st.personId,
    'ST' AS recordType,
    st.serviceDate,
    st.event AS employeeRecord
FROM ST_OUTPUT st

UNION ALL

SELECT
    ga.personId,
    'GA' AS recordType,
    st.serviceDate,
    ga.event AS employeeRecord
FROM GA_OUTPUT ga
LEFT JOIN ST_OUTPUT st
    ON ga.personId = st.personId;

-- FIX APPLIED: Added WHERE clause to filter out records where serviceDate is NULL or empty,
-- enforcing Business Requirement §4 (no NULL/empty serviceDate may be published).
CREATE TEMPORARY VIEW FINAL_OUTPUT AS
SELECT
    personId,
    recordType,
    serviceDate,
    employeeRecord
FROM ENRICHMENT_VIEW
WHERE serviceDate IS NOT NULL AND TRIM(serviceDate) <> '';

-- Intended sink (not included in this demo): FINAL_OUTPUT -> Kafka topic
