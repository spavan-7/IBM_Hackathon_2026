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

-- INCIDENT LOCATION
-- The final output forwards every record from ENRICHMENT_VIEW without validating the enriched values.
CREATE TEMPORARY VIEW FINAL_OUTPUT AS
SELECT
    personId,
    recordType,
    serviceDate,
    employeeRecord
FROM ENRICHMENT_VIEW;

-- Intended sink (not included in this demo): FINAL_OUTPUT -> Kafka topic
