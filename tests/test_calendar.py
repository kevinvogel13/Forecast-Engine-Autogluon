"""Tests for the calendar/holiday covariate generation."""
import pandas as pd

from engine.handlers import model_handler as M


def test_calendar_frame_basic_features():
    dates = pd.date_range('2024-01-01', periods=3, freq='MS')
    cal = M._calendar_frame(dates)
    assert list(cal['cal_month']) == [1, 2, 3]
    assert list(cal['cal_quarter']) == [1, 1, 1]
    assert 'cal_dayofweek' in cal.columns
    assert 'cal_weekofyear' in cal.columns


def test_calendar_frame_holidays_flag_new_years():
    # US holidays: 2024-01-01 is New Year's Day
    dates = pd.to_datetime(['2024-01-01', '2024-01-02'])
    cal = M._calendar_frame(dates, holiday_country='US')
    if 'cal_holiday' in cal.columns:          # only if `holidays` pkg installed
        assert cal['cal_holiday'].iloc[0] == 1
        assert cal['cal_holiday'].iloc[1] == 0


def test_augment_calendar_appends_columns():
    df = pd.DataFrame({'date': pd.date_range('2024-01-01', periods=4, freq='MS'),
                       'sales': [1, 2, 3, 4]})
    out, cols = M._augment_calendar(df, 'date')
    assert all(c.startswith('cal_') for c in cols)
    for c in cols:
        assert c in out.columns
    assert len(out) == len(df)


def test_future_cov_rows_recomputes_calendar_not_forward_fill():
    # Calendar columns must reflect the FUTURE dates, not carry the last value
    df = pd.DataFrame({
        'date': pd.date_range('2024-01-01', periods=6, freq='MS'),
        'sales': range(6),
        'cal_month': [1, 2, 3, 4, 5, 6],
    })
    rows = M._future_cov_rows(df, 'date', 'MS', horizon=3,
                              known_covariates_cols=['cal_month'],
                              holiday_country=None)
    # last observed month was 6 (June); the next three are Jul, Aug, Sep
    assert list(rows['cal_month']) == [7, 8, 9]
