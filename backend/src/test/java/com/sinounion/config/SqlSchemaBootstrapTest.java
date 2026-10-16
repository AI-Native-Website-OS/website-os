package com.sinounion.config;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlSchemaBootstrapTest {

    @Test
    void splitStatements_ignoresSemicolonsInCommentsStringsAndDollarQuotes() {
        String script =
                "SELECT ';'; -- 注释里的分号 ;\n"
                        + "CREATE OR REPLACE FUNCTION f() RETURNS int AS $$ BEGIN; RETURN 1; END; $$ LANGUAGE plpgsql;\n"
                        + "INSERT INTO t(a) VALUES (1);";

        List<String> statements = SqlSchemaBootstrap.splitStatements(script);

        assertEquals(3, statements.size());
        assertTrue(statements.get(0).contains("SELECT ';'"));
        assertTrue(statements.get(1).contains("$$"));
        assertTrue(statements.get(1).contains("END;"), "$$ 块内的分号不应被切分");
        assertTrue(statements.get(2).startsWith("INSERT"));
    }

    @Test
    void splitStatements_dropsCommentOnlyTail() {
        List<String> statements = SqlSchemaBootstrap.splitStatements("CREATE TABLE a (id int);\n-- 仅注释\n");
        assertEquals(1, statements.size());
        assertTrue(statements.get(0).startsWith("CREATE TABLE a"));
    }

    @Test
    void isInsert_classifiesIgnoringLeadingComments() {
        assertTrue(SqlSchemaBootstrap.isInsert("-- 注释\nINSERT INTO users (id) VALUES (1)"));
        assertFalse(SqlSchemaBootstrap.isInsert("CREATE TABLE users (id int)"));
        assertFalse(SqlSchemaBootstrap.isInsert("INSERTX INTO users"));
    }

    @Test
    void parseCreateTable_extractsColumnsAndSkipsConstraints() {
        String create =
                "CREATE TABLE IF NOT EXISTS demo (\n"
                        + "  id BIGSERIAL PRIMARY KEY,\n"
                        + "  name VARCHAR(50) NOT NULL UNIQUE,\n"
                        + "  ref BIGINT REFERENCES other(id) ON DELETE CASCADE,\n"
                        + "  amount NUMERIC(10, 2) DEFAULT 0,\n"
                        + "  note VARCHAR(100) DEFAULT 'a,b',\n"
                        + "  CONSTRAINT uk_demo UNIQUE (name)\n"
                        + ");";

        SqlSchemaBootstrap.CreateTable table = SqlSchemaBootstrap.parseCreateTable(create);

        assertEquals("demo", table.table);
        assertEquals(5, table.columns.size(), "表级 CONSTRAINT 不应被当作列");

        SqlSchemaBootstrap.ColumnDef id = table.columns.get(0);
        assertEquals("id", id.name);
        assertTrue(id.primaryKey);

        SqlSchemaBootstrap.ColumnDef amount = table.columns.get(3);
        assertEquals("amount", amount.name);
        assertEquals("NUMERIC(10, 2) DEFAULT 0", amount.definition);

        SqlSchemaBootstrap.ColumnDef note = table.columns.get(4);
        assertEquals("note", note.name);
        assertEquals("VARCHAR(100) DEFAULT 'a,b'", note.definition);
    }

    @Test
    void parseCreateTable_returnsNullForNonCreateTable() {
        assertNull(SqlSchemaBootstrap.parseCreateTable("CREATE UNIQUE INDEX IF NOT EXISTS idx ON t(a)"));
        assertNull(SqlSchemaBootstrap.parseCreateTable("INSERT INTO t VALUES (1)"));
    }

    @Test
    void parseCreateTable_handlesNestedParensAndDollarQuotes() {
        String create =
                "CREATE TABLE demo (\n"
                        + "  body TEXT DEFAULT $$a;b$$,\n"
                        + "  flag BOOLEAN DEFAULT TRUE\n"
                        + ");";

        SqlSchemaBootstrap.CreateTable table = SqlSchemaBootstrap.parseCreateTable(create);

        assertEquals(2, table.columns.size());
        assertEquals("body", table.columns.get(0).name);
        assertEquals("TEXT DEFAULT $$a;b$$", table.columns.get(0).definition);
    }
}
