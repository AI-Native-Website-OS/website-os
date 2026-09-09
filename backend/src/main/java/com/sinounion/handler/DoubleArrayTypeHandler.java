package com.sinounion.handler;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedTypes;

import java.sql.*;

@MappedTypes(double[].class)
public class DoubleArrayTypeHandler extends BaseTypeHandler<double[]> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, double[] parameter, JdbcType jdbcType) throws SQLException {
        if (parameter == null) {
            ps.setNull(i, Types.ARRAY);
        } else {
            ps.setArray(i, ps.getConnection().createArrayOf("float8", toObjectArray(parameter)));
        }
    }

    @Override
    public double[] getNullableResult(ResultSet rs, String columnName) throws SQLException {
        Array array = rs.getArray(columnName);
        return array != null ? toPrimitiveArray((Double[]) array.getArray()) : null;
    }

    @Override
    public double[] getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        Array array = rs.getArray(columnIndex);
        return array != null ? toPrimitiveArray((Double[]) array.getArray()) : null;
    }

    @Override
    public double[] getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        Array array = cs.getArray(columnIndex);
        return array != null ? toPrimitiveArray((Double[]) array.getArray()) : null;
    }

    private Double[] toObjectArray(double[] arr) {
        if (arr == null) return null;
        Double[] result = new Double[arr.length];
        for (int i = 0; i < arr.length; i++) result[i] = arr[i];
        return result;
    }

    private double[] toPrimitiveArray(Double[] arr) {
        if (arr == null) return null;
        double[] result = new double[arr.length];
        for (int i = 0; i < arr.length; i++) result[i] = arr[i];
        return result;
    }
}
